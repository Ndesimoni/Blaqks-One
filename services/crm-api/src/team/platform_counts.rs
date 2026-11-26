//! Account counts for Blaqks One's dashboard (BO1d, docs/blaqks-one-console.md §3 item 4):
//! company accounts by role, pending invitations and accounts created per month. Counts
//! only; Blaqks One's own account and the organisation are left out. Current figures skip
//! archived accounts; the monthly figures count every account created in the month.
use crate::error::ApiResult;
use sqlx::{FromRow, Postgres, Transaction};

type Tx<'a> = Transaction<'a, Postgres>;

#[derive(FromRow)]
pub struct Users {
    pub total: i64,
    pub admins: i64,
    pub staff: i64,
    pub pending: i64,
}

const COMPANY: &str = "role IN ('admin','staff') AND COALESCE(workspace_id,'')<>$1";

pub async fn users(tx: &mut Tx<'_>, organisation: &str) -> ApiResult<Users> {
    let sql = format!(
        "SELECT count(*) AS total,count(*) FILTER (WHERE role='admin') AS admins, \
         count(*) FILTER (WHERE role='staff') AS staff, \
         count(*) FILTER (WHERE accepted_at IS NULL) AS pending \
         FROM crm_user_profiles WHERE {COMPANY}"
    );
    Ok(sqlx::query_as(&sql)
        .bind(organisation)
        .fetch_one(&mut **tx)
        .await?)
}

/// Accounts created on or after `since`, and per month from `trend` (a month's first day).
pub async fn created(
    tx: &mut Tx<'_>,
    organisation: &str,
    since: &str,
    trend: &str,
) -> ApiResult<(i64, Vec<(String, i64)>)> {
    let after = "created_at>=(($2::date)::timestamp AT TIME ZONE 'Asia/Dubai')";
    let in_period = sqlx::query_scalar(&format!(
        "SELECT count(*) FROM crm_users WHERE {COMPANY} AND {after}"
    ))
    .bind(organisation)
    .bind(since)
    .fetch_one(&mut **tx)
    .await?;
    let months = sqlx::query_as(&format!(
        "SELECT to_char(created_at AT TIME ZONE 'Asia/Dubai','YYYY-MM') AS month,count(*) \
         FROM crm_users WHERE {COMPANY} AND {after} GROUP BY month"
    ))
    .bind(organisation)
    .bind(trend)
    .fetch_all(&mut **tx)
    .await?;
    Ok((in_period, months))
}
