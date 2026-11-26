//! Record counts for Blaqks One's dashboard (BO1d, docs/blaqks-one-console.md §3 item 4):
//! numbers of rows only, never a record's content. Per company there is one total, never a
//! count per type (§4). The organisation's leftover rows (BO1a) are left out. Dates are
//! Asia/Dubai calendar days given as `YYYY-MM-DD`.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'a> = Transaction<'a, Postgres>;

/// Records added since a day, how many of them were viewings, and the additions per month.
pub struct Added {
    pub in_period: i64,
    pub viewings: i64,
    pub months: Vec<(String, i64)>,
}

/// Every company's records, per collection.
pub async fn by_collection(tx: &mut Tx<'_>, organisation: &str) -> ApiResult<Vec<(String, i64)>> {
    sqlx::query_as(
        "SELECT collection,count(*) FROM crm_records WHERE workspace_id<>$1 GROUP BY collection",
    )
    .bind(organisation)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}

/// Each company's total number of records.
pub async fn by_company(tx: &mut Tx<'_>, organisation: &str) -> ApiResult<Vec<(String, i64)>> {
    sqlx::query_as(
        "SELECT workspace_id,count(*) FROM crm_records WHERE workspace_id<>$1 \
         GROUP BY workspace_id",
    )
    .bind(organisation)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}

/// Records added on or after `since`, and per month from `trend` (a month's first day).
pub async fn added(
    tx: &mut Tx<'_>,
    organisation: &str,
    since: &str,
    trend: &str,
) -> ApiResult<Added> {
    let (in_period, viewings): (i64, i64) = sqlx::query_as(
        "SELECT count(*),count(*) FILTER (WHERE collection='Viewings') FROM crm_records \
         WHERE workspace_id<>$1 AND created_at>=(($2::date)::timestamp AT TIME ZONE 'Asia/Dubai')",
    )
    .bind(organisation)
    .bind(since)
    .fetch_one(&mut **tx)
    .await?;
    let months = sqlx::query_as(
        "SELECT to_char(created_at AT TIME ZONE 'Asia/Dubai','YYYY-MM') AS month,count(*) \
         FROM crm_records WHERE workspace_id<>$1 \
         AND created_at>=(($2::date)::timestamp AT TIME ZONE 'Asia/Dubai') GROUP BY month",
    )
    .bind(organisation)
    .bind(trend)
    .fetch_all(&mut **tx)
    .await?;
    Ok(Added {
        in_period,
        viewings,
        months,
    })
}

/// Of the given website leads, the ones still kept as clients: each lead's ID with its
/// company and client ID, so finance can find the deals they became. Nothing else is read.
pub async fn lead_clients(
    tx: &mut Tx<'_>,
    leads: &[Uuid],
) -> ApiResult<Vec<(Uuid, String, String)>> {
    sqlx::query_as(
        "SELECT id,workspace_id,legacy_id FROM crm_records \
         WHERE id=ANY($1) AND collection='Clients'",
    )
    .bind(leads)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}
