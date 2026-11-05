//! `GET /api/crm/platform/metrics?period=30d|12m|all` (BO1d): Blaqks One's dashboard.
//! Only the live Blaqks One operator reads it (re-read inside the snapshot); everyone else
//! gets 403. Every figure is a count or a platform-wide sum from one read-only snapshot;
//! per-company rows carry usage only (docs/blaqks-one-console.md §4).
use super::{companies, figures, gather, growth, period, totals};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::{self, platform::company_rows},
};
use axum::{
    extract::{rejection::QueryRejection, Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MetricsQuery {
    period: Option<String>,
}

pub async fn metrics(
    State(state): State<AppState>,
    session: Session,
    query: Result<Query<MetricsQuery>, QueryRejection>,
) -> ApiResult<Json<Value>> {
    if session.user.role != "super-admin" {
        return Err(ApiError::forbidden());
    }
    let mut tx = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    workspaces::platform::operator(&mut tx, session.user.id).await?;
    let Query(query) = query.map_err(|_| ApiError::invalid(period::INVALID))?;
    let key = period::key(query.period.as_deref())?;
    let companies = company_rows(&state.pool).await?;
    let first = companies.iter().map(|c| c.created_on.as_str()).min();
    let period = period::resolve(&mut tx, key, first).await?;
    let gathered = gather::gather(&mut tx, &period).await?;
    let generated_at: String = sqlx::query_scalar(
        "SELECT to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')",
    )
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    let totals = totals::totals(&gathered, &companies);
    let in_period = figures::in_period(&gathered, &companies, &period);
    let trends = figures::trends(&gathered, &companies, &period);
    let growth = growth::growth(&gathered, &companies, &period.to);
    let rows = companies::rows(&state.pool, &gathered, companies).await?;
    let body = json!({
        "generatedAt": generated_at,
        "period": {"key": period.key, "from": period.from, "to": period.to},
        "totals": totals,
        "inPeriod": in_period,
        "trends": trends,
        "growth": growth,
        "companies": rows,
    });
    Ok(Json(body))
}
