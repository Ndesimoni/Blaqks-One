//! All-time marketplace-only aggregates; no stock, client or provider information.
use crate::{agreements::listings::market_stats, error::ApiResult};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;
pub async fn read(tx: &mut Transaction<'_, Postgres>, member: Uuid) -> ApiResult<Value> {
    let (accepted, completed) = market_stats::counts(tx, member).await?;
    let (samples,hours):(i64,Option<f64>)=sqlx::query_as("SELECT count(*)::bigint,avg(EXTRACT(epoch FROM(first_offer-created_at))/3600)::double precision FROM(SELECT r.id,r.created_at,min(a.created_at) AS first_offer FROM marketplace.crm_market_requests r JOIN marketplace.crm_market_answers a ON a.request_id=r.id WHERE a.member_id=$1 GROUP BY r.id,r.created_at) firsts")
        .bind(member).fetch_one(&mut **tx).await?;
    Ok(
        json!({"acceptedAgreements":accepted,"completedDeals":completed,
        "completionRate":if accepted>0 {Some(completed as f64*100.0/accepted as f64)}else{None},
        "averageResponseHours":hours,"responseSamples":samples,"disputesLost":null}),
    )
}
