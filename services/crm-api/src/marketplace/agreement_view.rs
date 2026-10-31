//! Marketplace views use Agreements-owned release projections, never agreement table reads.
use crate::{
    agreements::listings::{market_propose, market_release},
    auth::profile::UserRow,
    error::ApiResult,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;
pub async fn answer(
    tx: &mut Transaction<'_, Postgres>,
    share: Uuid,
    user: &UserRow,
) -> ApiResult<(Option<Value>, Value)> {
    let caller = crate::agreements::listings::marketplace::caller(user);
    Ok((
        market_propose::agreement(tx, share, user.id).await?,
        market_release::details(tx, share, &caller).await?,
    ))
}
pub async fn draft(
    tx: &mut Transaction<'_, Postgres>,
    request: Uuid,
    user: &UserRow,
) -> ApiResult<Value> {
    let selected:Option<Uuid>=sqlx::query_scalar("SELECT a.share_id FROM marketplace.crm_market_answers a JOIN marketplace.crm_market_requests r ON r.selected_answer_id=a.id WHERE r.id=$1 AND r.member_id=$2 AND r.paused_at IS NOT NULL AND r.closed_at IS NULL AND r.expires_at>now() AND a.state='chosen'")
        .bind(request).bind(user.id).fetch_optional(&mut **tx).await?;
    let Some(share) = selected else {
        return Ok(Value::Null);
    };
    if let Some(found) = market_propose::agreement(tx, share, user.id).await? {
        if matches!(
            found["state"].as_str(),
            Some("draft" | "sent" | "accepted" | "completed")
        ) {
            return Ok(Value::Null);
        }
    }
    if !crate::agreements::listings::marketplace::live(tx, share).await? {
        return Ok(Value::Null);
    }
    Ok(json!({"requestId":request,"share":market_propose::preview(tx,share,user).await?}))
}
