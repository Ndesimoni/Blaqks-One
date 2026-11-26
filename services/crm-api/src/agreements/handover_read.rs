//! Non-locking reads of in-company hand-over agreements for finance's preview, lists and
//! badges (design §17, H2 amendments 10 and 15). Only `deal_handover` agreements are read,
//! and whether an offer has run out is measured with `clock_timestamp()`.
use super::{
    handover::CHANGED,
    model::{Kind, State},
    store,
};
use crate::error::{ApiError, ApiResult};
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// The frozen offer a receiver, approver or Admin reviews. `expires_at` is RFC 3339 UTC,
/// as in the agreement detail; `kind` is `full` or `referral`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OfferTerms {
    pub version: i64,
    pub expires_at: String,
    pub expired: bool,
    pub kind: &'static str,
    pub fee_fils: i64,
    pub referral_share_bp: Option<i32>,
    pub client_name: String,
}

/// The offer kind and referral share of an agreement of `kind` with frozen `terms`, or
/// `None` when the two disagree.
pub(super) fn offer_kind(kind: &str, terms: &Value) -> Option<(&'static str, Option<i32>)> {
    if terms["kind"] != kind {
        return None;
    }
    let share = terms["money"]["senderShareBp"].as_i64()?;
    match (Kind::parse(kind).ok()?, share) {
        (Kind::Full, 0) => Some(("full", None)),
        (Kind::Referral, 1..=9_999) => Some(("referral", i32::try_from(share).ok())),
        _ => None,
    }
}

/// The open offer of the hand-over between `members` (sender, receiver), read through the
/// agreement's current revision. Anything else is a conflict: finance only reads its own.
pub async fn offer_terms(
    tx: &mut Transaction<'_, Postgres>,
    agreement: Uuid,
    members: (Uuid, Uuid),
) -> ApiResult<OfferTerms> {
    let changed = || ApiError::conflict(CHANGED);
    let row = store::load(tx, agreement).await?;
    let row = row
        .filter(|row| {
            row.handover()
                && row.workspace_id == row.recipient_workspace_id
                && row.state() == State::Sent
                && (row.sender_member_id, row.recipient_member_id) == members
        })
        .ok_or_else(changed)?;
    let terms = store::current(tx, agreement).await?.terms;
    let (kind, referral_share_bp) = offer_kind(&row.kind, &terms).ok_or_else(changed)?;
    let fee_fils = terms["money"]["amountFils"].as_i64().ok_or_else(changed)?;
    let name = terms["subject"]["client"]["displayName"].as_str();
    Ok(OfferTerms {
        version: row.version,
        expires_at: row.expires_at.ok_or_else(changed)?,
        expired: row.expired,
        kind,
        fee_fils,
        referral_share_bp,
        client_name: name.unwrap_or("Client").to_owned(),
    })
}

/// Each hand-over agreement's offer end (RFC 3339 UTC) and whether it has passed, in one
/// read. IDs that are not hand-over agreements, or have no end, are left out.
pub async fn deadlines(
    tx: &mut Transaction<'_, Postgres>,
    agreements: &[Uuid],
) -> ApiResult<Vec<(Uuid, String, bool)>> {
    if agreements.is_empty() {
        return Ok(Vec::new());
    }
    sqlx::query_as::<_, (Uuid, String, bool)>(
        "SELECT id,
         to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
         expires_at <= clock_timestamp()
         FROM agreements.crm_agreements
         WHERE id = ANY($1) AND origin='deal_handover' AND expires_at IS NOT NULL",
    )
    .bind(agreements)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}
