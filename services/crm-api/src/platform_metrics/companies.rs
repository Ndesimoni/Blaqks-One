//! Per-company usage rows (docs/blaqks-one-console.md §3 item 4 and §4): name, Admin,
//! created on, status, seats used of the limit, people active in the last 30 days, when
//! someone was last active and the total number of records. Never a money figure, never a
//! count per record type, never a client's name.
use super::gather::Gathered;
use crate::{error::ApiResult, team::account_type::seats, workspaces::platform::CompanyRow};
use serde_json::{json, Value};
use sqlx::PgPool;

pub async fn rows(pool: &PgPool, g: &Gathered, companies: Vec<CompanyRow>) -> ApiResult<Value> {
    let mut rows = Vec::with_capacity(companies.len());
    for company in companies {
        let (seats_used, seat_limit, _) = seats::usage(pool, &company.id).await?;
        let activity = g.activity.iter().find(|a| a.workspace == company.id);
        let seen = g
            .last_seen
            .iter()
            .find(|(workspace, _)| *workspace == company.id)
            .map(|(_, at)| at.clone());
        // Both are UTC times in one format, so the later one sorts last.
        let last_active = activity
            .map(|a| a.last_at.clone())
            .into_iter()
            .chain(seen)
            .max();
        let records: i64 = g
            .records_by_company
            .iter()
            .filter(|(workspace, _)| *workspace == company.id)
            .map(|(_, count)| *count)
            .sum();
        rows.push(json!({
            "id": company.id,
            "name": company.name,
            "admin": company.admin,
            "createdOn": company.created_on,
            "status": company.status,
            "seatsUsed": seats_used,
            "seatLimit": seat_limit,
            "activeUsers30d": activity.map_or(0, |a| a.active_30_days),
            "lastActiveAt": last_active,
            "records": records,
        }));
    }
    Ok(Value::Array(rows))
}
