//! What a hand-over preview shows (agreements design §17, amendments 10–11 and the owner's
//! free-text answer): the own-view money shape, four dated pipeline facts and twelve
//! property facts. Never the stored details object, the blocker or next-action texts,
//! notes, documents, contacts, or client, property or contact IDs.
use super::{
    compute::{self, Basis},
    handover_evidence::fee,
    handover_rows::HandoverRow,
    names,
    row::DealRow,
};
use crate::{
    agreements::handover::OfferTerms,
    error::ApiResult,
    finance::{access, calc::SecondSource, settings_store},
    records::handover_listing::Listing,
};
use serde_json::{json, Map, Value};
use sqlx::{Postgres, Transaction};

fn text(value: Option<&str>, max: usize) -> Value {
    match value.map(str::trim) {
        Some(text) if !text.is_empty() => json!(text.chars().take(max).collect::<String>()),
        _ => Value::Null,
    }
}

/// A `YYYY-MM-DD` date, or nothing: these fields are free text on the server.
fn iso_date(value: Option<&str>) -> Value {
    let value = value.map(str::trim).unwrap_or("");
    let shape = value.len() == 10
        && value.char_indices().all(|(at, c)| match at {
            4 | 7 => c == '-',
            _ => c.is_ascii_digit(),
        });
    match shape {
        true => json!(value),
        false => Value::Null,
    }
}

/// The listing: the allowlisted facts and the stored photos and floor plans, which the
/// review loads through `preview/files/{file}`.
pub fn property(listing: &Listing) -> Value {
    let long = ["description", "keySellingPoints", "amenities"];
    let mut value: Map<String, Value> = listing
        .facts()
        .map(|(name, stored)| {
            let max = if long.contains(&name) { 2000 } else { 200 };
            (name.to_owned(), text(stored, max))
        })
        .collect();
    let media = |field: &str| -> Value {
        let entries = listing.media(field).into_iter();
        Value::Array(
            entries
                .map(|(name, file, thumb)| json!({"name": name, "file": file, "thumb": thumb}))
                .collect(),
        )
    };
    value.insert("photos".into(), media("media_photos"));
    value.insert("floorPlans".into(), media("media_floorplans"));
    Value::Object(value)
}

/// The offer: frozen in the agreement, or read from the request for older ones.
pub fn offer(terms: Option<&OfferTerms>, request: &HandoverRow, fee_fils: i64) -> Value {
    match terms {
        Some(terms) => json!({"agreementVersion": terms.version, "expiresAt": terms.expires_at,
            "expired": terms.expired, "kind": terms.kind, "feeFils": terms.fee_fils,
            "referralShareBp": terms.referral_share_bp}),
        None => json!({"agreementVersion": null, "expiresAt": null, "expired": false,
            "kind": if request.referral_share_bp.is_some() { "referral" } else { "full" },
            "feeFils": fee_fils, "referralShareBp": request.referral_share_bp}),
    }
}

/// The deal's money and dates, read live; the fee, client, property and split are frozen
/// while an offer recorded as an agreement is open.
pub async fn deal(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    deal: &DealRow,
    request: &HandoverRow,
) -> ApiResult<Value> {
    let owner = Basis {
        primary: None,
        agreement: None,
        team_default_bp: 0,
        team_second_source: SecondSource::FirstAgent,
        vat_registered: false,
    };
    let split = compute::compute(deal, owner)?.calculation;
    let earns = receiver_earns(tx, workspace, deal, request).await?;
    let detail = |key: &str| text(deal.details.0.get(key).and_then(Value::as_str), 80);
    let date = |key: &str| iso_date(deal.details.0.get(key).and_then(Value::as_str));
    Ok(
        json!({"dealType": deal.deal_type, "stage": deal.stage, "earned": deal.earned(),
        "agreedValueFils": deal.agreed_value_fils, "feeBasis": deal.fee_basis,
        "feeRateBp": deal.fee_rate_bp, "fixedFeeFils": deal.fixed_fee_fils,
        "feeFils": fee(deal)?, "partnerShareBp": deal.partner_share_bp,
        "partnerName": text(deal.partner_name.as_deref(), 120),
        "partnerFils": split.partner_fils, "netFils": split.net_fils,
        "receivedFils": deal.approved_fils.clamp(0, split.net_fils.max(0)),
        "receiverEarnsFils": earns, "openedDate": date("opened_date"),
        "targetCloseDate": date("target_close_date"),
        "milestone": detail("pipeline_milestone"), "nextActionDue": date("next_action_due")}),
    )
}

/// The receiver's own commission line once the deal moves: nothing for the Admin (the
/// company keeps the net), unknown for an earned deal (its lines never change) or before
/// the team's finance settings exist.
async fn receiver_earns(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    deal: &DealRow,
    request: &HandoverRow,
) -> ApiResult<Option<i64>> {
    if request.to_admin {
        return Ok(Some(0));
    }
    if deal.earned() {
        return Ok(None);
    }
    let Some(settings) = settings_store::load(tx, workspace, false).await? else {
        return Ok(None);
    };
    let mut moved = deal.clone();
    moved.assignee_id = Some(request.to_id);
    moved.assignee_staff = true;
    if let Some(share) = request.referral_share_bp {
        moved.second_agent_id = Some(request.from_id);
        moved.second_agent_share_bp = Some(share);
        moved.second_agent_kind = Some("referral".into());
    }
    let today = access::today(tx).await?;
    let agreement = compute::agreement_on(tx, workspace, request.to_id, &today).await?;
    let basis = Basis {
        primary: Some(request.to_id),
        agreement,
        team_default_bp: settings.agent_share_bp,
        team_second_source: names::second_source(&settings.second_agent_source),
        vat_registered: settings.vat_registered,
    };
    Ok(compute::compute(&moved, basis)?.calculation.primary_fils)
}
