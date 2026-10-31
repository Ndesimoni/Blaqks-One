//! The listing part of `GET /agreements/waiting`: pending, unexpired shares sent to the
//! caller in this company, for the Agreements sidebar badge.
use crate::error::ApiResult;
use sqlx::PgPool;
use uuid::Uuid;

pub async fn count(pool: &PgPool, workspace: &str, member: Uuid) -> ApiResult<i64> {
    Ok(sqlx::query_scalar(
        "SELECT count(*) FROM agreements.crm_listing_shares WHERE recipient_workspace_id=$1 \
         AND to_id=$2 AND status='pending' \
         AND least(offer_ends_at,view_ends_at)>clock_timestamp()",
    )
    .bind(workspace)
    .bind(member)
    .fetch_one(pool)
    .await?)
}
