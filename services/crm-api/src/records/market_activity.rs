//! Company eligibility counts for the broker marketplace (docs/broker-marketplace.md §15,
//! packet MK1). The marketplace receives these numbers only: no record content, no IDs and
//! no client details leave this module.
use crate::error::ApiResult;
use serde::Serialize;
use sqlx::{Postgres, Transaction};

/// Counts of the company's own connected records that show real use of the CRM.
#[derive(Clone, Copy, Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Counts {
    pub properties: i64,
    pub clients: i64,
    pub contacts: i64,
    pub follow_ups: i64,
    pub viewings: i64,
    /// Any of those records created or changed in the last 30 days.
    pub recent: bool,
}

/// One query over the caller's workspace. Deals and agreements are not counted (§15).
pub async fn counts(tx: &mut Transaction<'_, Postgres>, workspace: &str) -> ApiResult<Counts> {
    Ok(sqlx::query_as(
        "SELECT count(*) FILTER (WHERE collection='Properties') AS properties, \
         count(*) FILTER (WHERE collection='Clients') AS clients, \
         count(*) FILTER (WHERE collection='Contacts') AS contacts, \
         count(*) FILTER (WHERE collection='Follow-ups') AS follow_ups, \
         count(*) FILTER (WHERE collection='Viewings') AS viewings, \
         COALESCE(bool_or(updated_at > now() - interval '30 days'), false) AS recent \
         FROM crm_records WHERE workspace_id=$1 \
           AND collection IN ('Properties','Clients','Contacts','Follow-ups','Viewings')",
    )
    .bind(workspace)
    .fetch_one(&mut **tx)
    .await?)
}
