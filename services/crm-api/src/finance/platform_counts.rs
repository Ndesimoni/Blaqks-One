//! Deal and payment figures for Blaqks One's dashboard (BO1d, docs/blaqks-one-console.md
//! §3 item 4): platform-wide counts and sums only, never a figure per company (§4). Earned
//! means the deal has an earned date; open means not earned, lost, cancelled or completed.
//! The organisation is left out. Dates are Asia/Dubai calendar days as `YYYY-MM-DD`.
use crate::error::ApiResult;
use sqlx::{FromRow, Postgres, Transaction};

type Tx<'a> = Transaction<'a, Postgres>;

const OPEN: &str = "earned_on IS NULL AND stage NOT IN ('Lost','Cancelled','Completed')";

#[derive(FromRow)]
pub struct Deals {
    pub recorded: i64,
    pub open: i64,
    pub earned: i64,
    pub lost: i64,
    pub earned_value_fils: i64,
    pub open_value_fils: i64,
    /// The gross commission of every earned deal's current snapshot.
    pub commission_fils: i64,
}

/// Deals earned since a day (count and agreed value) and per month from a trend start.
pub struct Earned {
    pub in_period: i64,
    pub value_in_period: i64,
    pub months: Vec<(String, i64, i64)>,
}

pub async fn deals(tx: &mut Tx<'_>, organisation: &str) -> ApiResult<Deals> {
    let sql = format!(
        "SELECT count(*) AS recorded,count(*) FILTER (WHERE {OPEN}) AS open, \
         count(*) FILTER (WHERE earned_on IS NOT NULL) AS earned, \
         count(*) FILTER (WHERE earned_on IS NULL AND stage='Lost') AS lost, \
         COALESCE(sum(agreed_value_fils) FILTER (WHERE earned_on IS NOT NULL),0)::bigint \
           AS earned_value_fils, \
         COALESCE(sum(agreed_value_fils) FILTER (WHERE {OPEN}),0)::bigint AS open_value_fils, \
         (SELECT COALESCE(sum(s.gross_fils),0)::bigint FROM crm_deal_snapshots s \
           JOIN crm_deals e ON e.id=s.deal_id WHERE s.superseded_at IS NULL \
           AND e.earned_on IS NOT NULL AND e.workspace_id<>$1) AS commission_fils \
         FROM crm_deals WHERE workspace_id<>$1"
    );
    Ok(sqlx::query_as(&sql)
        .bind(organisation)
        .fetch_one(&mut **tx)
        .await?)
}

pub async fn earned(
    tx: &mut Tx<'_>,
    organisation: &str,
    since: &str,
    trend: &str,
) -> ApiResult<Earned> {
    let (in_period, value_in_period): (i64, i64) = sqlx::query_as(
        "SELECT count(*),COALESCE(sum(agreed_value_fils),0)::bigint FROM crm_deals \
         WHERE workspace_id<>$1 AND earned_on>=$2::date",
    )
    .bind(organisation)
    .bind(since)
    .fetch_one(&mut **tx)
    .await?;
    let months = sqlx::query_as(
        "SELECT to_char(earned_on,'YYYY-MM') AS month,count(*), \
         COALESCE(sum(agreed_value_fils),0)::bigint FROM crm_deals \
         WHERE workspace_id<>$1 AND earned_on>=$2::date GROUP BY month",
    )
    .bind(organisation)
    .bind(trend)
    .fetch_all(&mut **tx)
    .await?;
    Ok(Earned {
        in_period,
        value_in_period,
        months,
    })
}

/// Payments recorded (every one not voided) and the approved total.
pub async fn payments(tx: &mut Tx<'_>, organisation: &str) -> ApiResult<(i64, i64)> {
    sqlx::query_as(
        "SELECT count(*) FILTER (WHERE status<>'void'), \
         COALESCE(sum(amount_fils) FILTER (WHERE status='approved'),0)::bigint \
         FROM crm_payments WHERE workspace_id<>$1",
    )
    .bind(organisation)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

/// The day each company earned its first deal, for the median time to a first earned
/// deal. Only the date leaves finance, never an amount.
pub async fn first_earned(tx: &mut Tx<'_>, organisation: &str) -> ApiResult<Vec<(String, String)>> {
    sqlx::query_as(
        "SELECT workspace_id,min(earned_on)::text FROM crm_deals \
         WHERE workspace_id<>$1 AND earned_on IS NOT NULL GROUP BY workspace_id",
    )
    .bind(organisation)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}

/// Deals earned on or after `since` for the given (company, client ID) pairs, as a count and
/// their agreed value: "property sold through the websites" when the clients came in
/// through website enquiries.
pub async fn sold_to(
    tx: &mut Tx<'_>,
    clients: &[(String, String)],
    since: &str,
) -> ApiResult<(i64, i64)> {
    let (workspaces, refs): (Vec<&str>, Vec<&str>) = clients
        .iter()
        .map(|(workspace, client)| (workspace.as_str(), client.as_str()))
        .unzip();
    sqlx::query_as(
        "SELECT count(*),COALESCE(sum(d.agreed_value_fils),0)::bigint FROM crm_deals d \
         JOIN (SELECT DISTINCT w,r FROM unnest($1::text[],$2::text[]) AS c(w,r)) c \
           ON d.workspace_id=c.w AND d.client_ref=c.r \
         WHERE d.earned_on>=$3::date",
    )
    .bind(workspaces)
    .bind(refs)
    .bind(since)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}
