//! Transactions between brokers for Blaqks One's dashboard (BO1d, docs/blaqks-one-console.md
//! §3 item 4): agreements between two different companies (never in-company hand-overs and
//! never drafts), as platform-wide counts and sums only. The deal value is the frozen
//! property's asking price; the commission is the agreed amount being shared. Accepted
//! means the agreement was accepted at some point; the sums cover agreements in force or
//! completed. Dates are Asia/Dubai calendar days as `YYYY-MM-DD`.
use crate::error::ApiResult;
use sqlx::{FromRow, Postgres, Transaction};

type Tx<'a> = Transaction<'a, Postgres>;

const BETWEEN: &str = "WITH x AS (SELECT a.state, \
      (SELECT min(e.created_at) FROM agreements.crm_agreement_events e \
        WHERE e.agreement_id=a.id AND e.action='accepted') AS accepted_at, \
      COALESCE((r.terms->'subject'->'property'->>'askingPriceFils')::bigint,0) AS value, \
      COALESCE((r.terms->'money'->>'amountFils')::bigint,0) AS commission \
    FROM agreements.crm_agreements a \
    LEFT JOIN agreements.crm_agreement_revisions r ON r.id=a.current_revision_id \
    WHERE a.workspace_id<>a.recipient_workspace_id AND a.state<>'draft' \
      AND a.workspace_id<>$1 AND a.recipient_workspace_id<>$1)";

#[derive(FromRow)]
pub struct BetweenCompanies {
    pub agreements: i64,
    pub accepted: i64,
    pub completed: i64,
    pub value_fils: i64,
    pub commission_fils: i64,
    pub accepted_in_period: i64,
    pub value_in_period: i64,
}

/// Totals, with the agreements accepted on or after `since`.
pub async fn between_companies(
    tx: &mut Tx<'_>,
    organisation: &str,
    since: &str,
) -> ApiResult<BetweenCompanies> {
    let made = "accepted_at IS NOT NULL AND state IN ('accepted','completed')";
    let recent = "accepted_at>=(($2::date)::timestamp AT TIME ZONE 'Asia/Dubai')";
    let sql = format!(
        "{BETWEEN} SELECT count(*) AS agreements,count(accepted_at) AS accepted, \
         count(*) FILTER (WHERE state='completed') AS completed, \
         COALESCE(sum(value) FILTER (WHERE {made}),0)::bigint AS value_fils, \
         COALESCE(sum(commission) FILTER (WHERE {made}),0)::bigint AS commission_fils, \
         count(*) FILTER (WHERE {recent}) AS accepted_in_period, \
         COALESCE(sum(value) FILTER (WHERE {recent}),0)::bigint AS value_in_period FROM x"
    );
    Ok(sqlx::query_as(&sql)
        .bind(organisation)
        .bind(since)
        .fetch_one(&mut **tx)
        .await?)
}

/// Agreements between companies accepted per month, from `trend` (a month's first day).
pub async fn accepted_by_month(
    tx: &mut Tx<'_>,
    organisation: &str,
    trend: &str,
) -> ApiResult<Vec<(String, i64)>> {
    let sql = format!(
        "{BETWEEN} SELECT to_char(accepted_at AT TIME ZONE 'Asia/Dubai','YYYY-MM') AS month, \
         count(*) FROM x \
         WHERE accepted_at>=(($2::date)::timestamp AT TIME ZONE 'Asia/Dubai') GROUP BY month"
    );
    sqlx::query_as(&sql)
        .bind(organisation)
        .bind(trend)
        .fetch_all(&mut **tx)
        .await
        .map_err(Into::into)
}
