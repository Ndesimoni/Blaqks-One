//! A deal's terms for comparison and history (finance-design §2.2): the stored row in the
//! request's shape, which money terms lock once earned, and the recorded changes.
use super::{
    fields::{STAGES, TYPES},
    input::DealInput,
    row::DealRow,
};
use crate::finance::events::Changes;
use serde_json::{Map, Value};

/// The money, rate and party fields recorded in history (free text only as "changed").
pub fn terms(before: Option<&DealInput>, after: &DealInput) -> Changes {
    let old = |pick: fn(&DealInput) -> Value| before.map_or(Value::Null, pick);
    Changes::default()
        .pair(
            "clientId",
            old(|d| d.client_ref.clone().into()),
            after.client_ref.clone(),
        )
        .pair(
            "propertyId",
            old(|d| d.property_ref.clone().into()),
            after.property_ref.clone(),
        )
        .pair("dealType", old(|d| d.deal_type.into()), after.deal_type)
        .pair("stage", old(|d| d.stage.into()), after.stage)
        .pair(
            "agreedValueFils",
            old(|d| d.agreed_value_fils.into()),
            after.agreed_value_fils,
        )
        .pair("feeBasis", old(|d| d.fee_basis.into()), after.fee_basis)
        .pair(
            "feeRateBp",
            old(|d| d.fee_rate_bp.into()),
            after.fee_rate_bp,
        )
        .pair(
            "fixedFeeFils",
            old(|d| d.fixed_fee_fils.into()),
            after.fixed_fee_fils,
        )
        .pair(
            "partnerShareBp",
            old(|d| d.partner_share_bp.into()),
            after.partner_share_bp,
        )
        .text(
            "partnerName",
            before.map_or(after.partner_name.is_some(), |d| {
                d.partner_name != after.partner_name
            }),
        )
        .text(
            "details",
            before.map_or(!after.details.is_empty(), |d| d.details != after.details),
        )
}

fn known(options: &[&'static str], value: &str) -> &'static str {
    options
        .iter()
        .find(|option| **option == value)
        .copied()
        .unwrap_or("")
}

/// The stored deal in the request's shape, for comparison and history.
pub fn stored(deal: &DealRow) -> DealInput {
    let details: Map<String, Value> = deal.details.0.as_object().cloned().unwrap_or_default();
    DealInput {
        deal_id: Some(deal.legacy_id.clone()),
        client_ref: deal.client_ref.clone(),
        property_ref: deal.property_ref.clone(),
        deal_type: known(&TYPES, &deal.deal_type),
        stage: known(&STAGES, &deal.stage),
        agreed_value_fils: deal.agreed_value_fils,
        fee_basis: known(&["percentage", "fixed"], &deal.fee_basis),
        fee_rate_bp: deal.fee_rate_bp,
        fixed_fee_fils: deal.fixed_fee_fils,
        partner_share_bp: deal.partner_share_bp,
        partner_name: deal.partner_name.clone(),
        details,
    }
}

/// Money terms locked once earned (the terms-locked trigger covers the same columns).
pub fn money_changed(before: &DealInput, after: &DealInput) -> bool {
    (
        before.deal_type,
        before.agreed_value_fils,
        before.fee_basis,
        before.fee_rate_bp,
    ) != (
        after.deal_type,
        after.agreed_value_fils,
        after.fee_basis,
        after.fee_rate_bp,
    ) || (before.fixed_fee_fils, before.partner_share_bp)
        != (after.fixed_fee_fils, after.partner_share_bp)
}
