//! Marketplace-owned authority check used immediately before an agreement releases details.
use crate::{
    error::{ApiError, ApiResult},
    records::{listing_holders, market_requirements},
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// The selected request, its private source client, and the offered listing must still belong to
/// the two named brokers. This deliberately does not lock the request: reopening locks agreement
/// rows before shares too, so acceptance and reopening have one consistent lock order.
pub async fn require_current(tx: &mut Transaction<'_, Postgres>, share: Uuid) -> ApiResult<()> {
    let row: Option<(String, Uuid, Uuid, String, Uuid, Uuid)> = sqlx::query_as(
        "SELECT r.workspace_id,r.member_id,s.source_record_id,a.workspace_id,a.member_id,\
         a.source_record_id FROM marketplace.crm_market_answers a \
         JOIN marketplace.crm_market_requests r ON r.id=a.request_id \
         JOIN marketplace.crm_market_request_sources s ON s.request_id=r.id \
         WHERE a.share_id=$1 AND r.selected_answer_id=a.id AND a.state='chosen' \
         AND r.paused_at IS NOT NULL AND r.closed_at IS NULL AND r.expires_at>now() AND s.open",
    )
    .bind(share)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((request_workspace, requester, client, listing_workspace, broker, listing)) = row
    else {
        return Err(ApiError::conflict(
            "The selected marketplace offer is no longer available.",
        ));
    };
    let clients =
        market_requirements::still_held(tx, &[(request_workspace, client, requester)]).await?;
    let listings = listing_holders::held_by(tx, &listing_workspace, broker, &[listing]).await?;
    if !clients.contains(&client) || !listings.contains(&listing) {
        return Err(ApiError::conflict(
            "The selected marketplace offer is no longer available.",
        ));
    }
    Ok(())
}

/// A historical accepted release remains linked after request close, but both source records must
/// still be held by the two named brokers whenever private details are read.
pub async fn holders_current(tx: &mut Transaction<'_, Postgres>, share: Uuid) -> ApiResult<bool> {
    let row: Option<(String, Uuid, Uuid, String, Uuid, Uuid)> = sqlx::query_as(
        "SELECT r.workspace_id,r.member_id,s.source_record_id,a.workspace_id,a.member_id,\
         a.source_record_id FROM marketplace.crm_market_answers a \
         JOIN marketplace.crm_market_requests r ON r.id=a.request_id \
         JOIN marketplace.crm_market_request_sources s ON s.request_id=r.id WHERE a.share_id=$1",
    )
    .bind(share)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((request_workspace, requester, client, listing_workspace, broker, listing)) = row
    else {
        return Ok(false);
    };
    let clients =
        market_requirements::still_held(tx, &[(request_workspace, client, requester)]).await?;
    let listings = listing_holders::held_by(tx, &listing_workspace, broker, &[listing]).await?;
    Ok(clients.contains(&client) && listings.contains(&listing))
}
