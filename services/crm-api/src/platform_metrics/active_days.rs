//! Daily active users (BO1d, docs/blaqks-one-console.md §3 item 4): one row per person per
//! Asia/Dubai calendar day on which they used a signed-in session. `mark` is called when a
//! session is issued and when a session is first used on a new day, so most requests write
//! nothing. The reads below leave the organisation (Blaqks One) out.
use crate::error::ApiResult;
use sqlx::{FromRow, PgExecutor, Postgres, Transaction};
use uuid::Uuid;

type Tx<'a> = Transaction<'a, Postgres>;

const TODAY: &str = "(now() AT TIME ZONE 'Asia/Dubai')::date";

/// Marks `user` active today in their workspace; a second call the same day changes nothing.
pub async fn mark<'e>(executor: impl PgExecutor<'e>, user: Uuid) -> ApiResult<()> {
    sqlx::query(&format!(
        "INSERT INTO platform_metrics.crm_user_active_days (user_id,workspace_id,day) \
         SELECT id,workspace_id,{TODAY} FROM crm_all_user_profiles WHERE id=$1 \
         ON CONFLICT DO NOTHING"
    ))
    .bind(user)
    .execute(executor)
    .await?;
    Ok(())
}

/// Distinct people active today, in the last 7 days and in the last 30 days.
pub async fn users(tx: &mut Tx<'_>, organisation: &str) -> ApiResult<(i64, i64, i64)> {
    sqlx::query_as(&format!(
        "SELECT count(DISTINCT user_id) FILTER (WHERE day={TODAY}), \
         count(DISTINCT user_id) FILTER (WHERE day>{TODAY}-7),count(DISTINCT user_id) \
         FROM platform_metrics.crm_user_active_days WHERE workspace_id<>$1 AND day>{TODAY}-30"
    ))
    .bind(organisation)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

/// The first day anyone was marked active: daily activity is tracked from then on.
pub async fn first_day(tx: &mut Tx<'_>) -> ApiResult<Option<String>> {
    sqlx::query_scalar("SELECT min(day)::text FROM platform_metrics.crm_user_active_days")
        .fetch_one(&mut **tx)
        .await
        .map_err(Into::into)
}

/// Distinct people active per month, from `trend` (a month's first day).
pub async fn monthly(
    tx: &mut Tx<'_>,
    organisation: &str,
    trend: &str,
) -> ApiResult<Vec<(String, i64)>> {
    sqlx::query_as(
        "SELECT to_char(day,'YYYY-MM') AS month,count(DISTINCT user_id) \
         FROM platform_metrics.crm_user_active_days \
         WHERE workspace_id<>$1 AND day>=$2::date GROUP BY month",
    )
    .bind(organisation)
    .bind(trend)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}

/// One company's activity: people active in the last 30 days, the last active day and that
/// day's start in Asia/Dubai as a UTC ISO time.
#[derive(FromRow)]
pub struct Company {
    pub workspace: String,
    pub active_30_days: i64,
    pub last_day: String,
    pub last_at: String,
}

pub async fn companies(tx: &mut Tx<'_>, organisation: &str) -> ApiResult<Vec<Company>> {
    Ok(sqlx::query_as(&format!(
        "SELECT workspace_id AS workspace, \
         count(DISTINCT user_id) FILTER (WHERE day>{TODAY}-30) AS active_30_days, \
         max(day)::text AS last_day, \
         to_char((max(day)::timestamp AT TIME ZONE 'Asia/Dubai') AT TIME ZONE 'UTC', \
           'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS last_at \
         FROM platform_metrics.crm_user_active_days WHERE workspace_id<>$1 \
         GROUP BY workspace_id"
    ))
    .bind(organisation)
    .fetch_all(&mut **tx)
    .await?)
}

/// Companies with someone active this calendar month and in the previous one.
pub async fn companies_by_month(tx: &mut Tx<'_>, organisation: &str) -> ApiResult<(i64, i64)> {
    let month = format!("date_trunc('month',{TODAY})::date");
    sqlx::query_as(&format!(
        "SELECT count(DISTINCT workspace_id) FILTER (WHERE day>={month}), \
         count(DISTINCT workspace_id) FILTER (WHERE day<{month}) \
         FROM platform_metrics.crm_user_active_days \
         WHERE workspace_id<>$1 AND day>=({month}-interval '1 month')::date"
    ))
    .bind(organisation)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}
