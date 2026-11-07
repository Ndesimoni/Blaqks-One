//! Public marketplace aggregates from actual accepted agreements, never private CRM deals.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;
pub async fn counts(tx: &mut Transaction<'_, Postgres>, member: Uuid) -> ApiResult<(i64, i64)> {
    Ok(sqlx::query_as("SELECT count(*)::bigint,count(*) FILTER(WHERE a.state='completed')::bigint FROM agreements.crm_market_releases r JOIN agreements.crm_agreements a ON a.id=r.agreement_id WHERE r.requester_id=$1 OR r.broker_id=$1")
        .bind(member).fetch_one(&mut **tx).await?)
}
