//! Help-request figures for Blaqks One's dashboard (BO1c, docs/blaqks-one-console.md §11):
//! counts and a median time only; subjects and messages never leave the schema.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};

pub struct Help {
    /// Waiting for a Blaqks One answer, today.
    pub open: i64,
    /// Answered and waiting for the member, today.
    pub waiting: i64,
    /// Opened on or after the period's first day.
    pub opened: i64,
    /// Solved on or after the period's first day (and still solved).
    pub solved: i64,
    /// The median whole minutes from opening to Blaqks One's first answer, for requests
    /// opened in the period; `None` until one of them is answered.
    pub first_answer_minutes: Option<i64>,
}

/// The figures from `since`, an Asia/Dubai day.
pub async fn help(tx: &mut Transaction<'_, Postgres>, since: &str) -> ApiResult<Help> {
    let (open, waiting, opened, solved, minutes): (i64, i64, i64, i64, Option<f64>) =
        sqlx::query_as(
            "WITH start AS (SELECT (($1::date)::timestamp AT TIME ZONE 'Asia/Dubai') AS at) \
             SELECT count(*) FILTER (WHERE r.state='open'), \
               count(*) FILTER (WHERE r.state='waiting'), \
               count(*) FILTER (WHERE r.created_at>=start.at), \
               count(*) FILTER (WHERE r.state='solved' AND r.solved_at>=start.at), \
               percentile_cont(0.5) WITHIN GROUP \
                 (ORDER BY extract(epoch FROM r.first_answer_at-r.created_at)/60.0) \
                 FILTER (WHERE r.created_at>=start.at AND r.first_answer_at IS NOT NULL) \
             FROM support.crm_support_requests r CROSS JOIN start GROUP BY start.at",
        )
        .bind(since)
        .fetch_optional(&mut **tx)
        .await?
        .unwrap_or((0, 0, 0, 0, None));
    Ok(Help {
        open,
        waiting,
        opened,
        solved,
        first_answer_minutes: minutes.map(|value| value.round() as i64),
    })
}
