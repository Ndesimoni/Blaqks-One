//! Marketplace figures for Blaqks One's dashboard (BO1d, docs/blaqks-one-console.md §3
//! item 4): counts only. A company is approved when its latest decision is an approval and
//! no newer application waits (the same rule as `state::state`).
use crate::error::ApiResult;
use sqlx::{FromRow, Postgres, Transaction};

#[derive(FromRow)]
pub struct Marketplace {
    pub companies_approved: i64,
    pub members: i64,
    pub requests_posted: i64,
    pub answers: i64,
}

pub async fn totals(
    tx: &mut Transaction<'_, Postgres>,
    organisation: &str,
) -> ApiResult<Marketplace> {
    Ok(sqlx::query_as(
        "SELECT (SELECT count(*) FROM (SELECT DISTINCT ON (workspace_id) \
             workspace_id,decision,created_at FROM marketplace.crm_market_decisions \
             WHERE workspace_id<>$1 ORDER BY workspace_id,created_at DESC,id DESC) d \
           WHERE d.decision='approved' AND NOT EXISTS (SELECT 1 \
             FROM marketplace.crm_market_applications a \
             WHERE a.workspace_id=d.workspace_id AND a.created_at>d.created_at)) \
           AS companies_approved, \
         (SELECT count(*) FROM marketplace.crm_market_profiles WHERE workspace_id<>$1) \
           AS members, \
         (SELECT count(*) FROM marketplace.crm_market_requests WHERE workspace_id<>$1) \
           AS requests_posted, \
         (SELECT count(*) FROM marketplace.crm_market_answers WHERE workspace_id<>$1) \
           AS answers",
    )
    .bind(organisation)
    .fetch_one(&mut **tx)
    .await?)
}
