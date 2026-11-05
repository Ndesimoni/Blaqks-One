//! One immutable release per accepted marketplace agreement; current authority still gates reads.
use super::{
    access::{Caller, Viewer},
    places, store,
};
use crate::{
    auth::members,
    error::{ApiError, ApiResult},
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn accept(
    tx: &mut Transaction<'_, Postgres>,
    agreement: Uuid,
    revision: Uuid,
    digest: &str,
) -> ApiResult<()> {
    let share: Option<Uuid> =
        sqlx::query_scalar("SELECT listing_share_id FROM agreements.crm_agreements WHERE id=$1")
            .bind(agreement)
            .fetch_one(&mut **tx)
            .await?;
    let Some(share) = share else { return Ok(()) };
    let row = store::locked(tx, share)
        .await?
        .ok_or_else(ApiError::missing)?;
    if row.origin != "marketplace" {
        return Ok(());
    }
    if !row.open() || row.paused() {
        return Err(ApiError::conflict(
            "The selected marketplace offer is no longer available.",
        ));
    }
    crate::marketplace::agreement_access::require_current(tx, share).await?;
    for member in [row.from_id, row.to_id] {
        crate::marketplace::visibility::visible(tx, member)
            .await?
            .ok_or_else(ApiError::missing)?;
    }
    sqlx::query("INSERT INTO agreements.crm_market_releases(agreement_id,share_id,revision_id,accepted_digest,requester_id,broker_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(agreement_id) DO NOTHING")
        .bind(agreement).bind(share).bind(revision).bind(digest).bind(row.to_id).bind(row.from_id).execute(&mut **tx).await?;
    Ok(())
}

pub async fn authorized(
    tx: &mut Transaction<'_, Postgres>,
    row: &store::ShareRow,
    caller: &Caller<'_>,
) -> ApiResult<bool> {
    if row.origin != "marketplace" || !row.open() || row.paused() {
        return Ok(false);
    }
    if caller.id != row.from_id && caller.id != row.to_id {
        return Ok(false);
    }
    let place = places::one(tx, row, caller).await?;
    if !matches!(place, Some(Viewer::Sender | Viewer::Agent)) {
        return Ok(false);
    }
    if !crate::marketplace::agreement_access::holders_current(tx, row.id).await? {
        return Ok(false);
    }
    let recipient = members::live_name(&mut **tx, &row.recipient_workspace_id, row.to_id).await?;
    if recipient.is_none() {
        return Ok(false);
    }
    for member in [row.from_id, row.to_id] {
        if crate::marketplace::visibility::visible(tx, member)
            .await?
            .is_none()
        {
            return Ok(false);
        }
    }
    Ok(sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM agreements.crm_market_releases r JOIN agreements.crm_agreements a ON a.id=r.agreement_id WHERE r.share_id=$1 AND a.state IN ('accepted','completed'))")
        .bind(row.id).fetch_one(&mut **tx).await?)
}

pub async fn details(
    tx: &mut Transaction<'_, Postgres>,
    share: Uuid,
    caller: &Caller<'_>,
) -> ApiResult<Value> {
    let row = store::find(tx, share)
        .await?
        .ok_or_else(ApiError::missing)?;
    if !authorized(tx, &row, caller).await? {
        return Ok(json!({"released":false}));
    }
    let requester: Option<(String, Option<String>)> =
        sqlx::query_as("SELECT name,phone FROM crm_member_profiles WHERE id=$1")
            .bind(row.to_id)
            .fetch_optional(&mut **tx)
            .await?;
    let files = |kind: &str| {
        row.media
            .as_array()
            .into_iter()
            .flatten()
            .filter(|e| e["kind"] == kind)
            .map(|e| json!({"name":e["name"],"file":e["file"],"thumb":e["thumb"]}))
            .collect::<Vec<_>>()
    };
    Ok(
        json!({"released":true,"listing":row.facts,"photos":files("photo"),"floorPlans":files("floorPlan"),"shareId":row.id,
        "contacts":{"broker":{"name":row.from_name,"phone":row.from_phone},"requester":requester.map(|(name,phone)|json!({"name":name,"phone":phone}))}}),
    )
}

pub async fn standing(tx: &mut Transaction<'_, Postgres>, share: Uuid) -> ApiResult<bool> {
    Ok(sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM agreements.crm_agreements WHERE listing_share_id=$1 AND state IN ('accepted','completed'))")
        .bind(share).fetch_one(&mut **tx).await?)
}

/// Locks every agreement before Marketplace locks its selected shares, matching acceptance's
/// agreement-then-share order. The returned decision is based on the locked current states.
pub async fn lock_standing(tx: &mut Transaction<'_, Postgres>, shares: &[Uuid]) -> ApiResult<bool> {
    let ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM agreements.crm_agreements WHERE listing_share_id=ANY($1) ORDER BY id",
    )
    .bind(shares)
    .fetch_all(&mut **tx)
    .await?;
    let states: Vec<String> = sqlx::query_scalar(
        "SELECT state FROM agreements.crm_agreements WHERE id=ANY($1) \
         ORDER BY id FOR UPDATE SKIP LOCKED",
    )
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await?;
    if states.len() != ids.len() {
        return Err(ApiError::conflict(
            "An agreement action is in progress. Refresh and try again.",
        ));
    }
    Ok(states
        .iter()
        .any(|state| matches!(state.as_str(), "accepted" | "completed")))
}
