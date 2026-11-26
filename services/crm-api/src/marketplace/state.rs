//! The company's marketplace state: its latest decision, or `pending` when an application is
//! newer than every decision; none at all is `not_applied` (§13, §15). A declined company may
//! apply again after three days.
use crate::error::ApiResult;
use serde::Serialize;
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use time::{format_description::well_known::Rfc3339, Duration, OffsetDateTime};
use uuid::Uuid;

pub const WAIT: Duration = Duration::days(3);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum State {
    NotApplied,
    Pending,
    Approved,
    Declined,
    Revoked,
}

/// The newest application and the newest decision, whichever order they came in.
#[derive(Debug, sqlx::FromRow)]
pub struct Latest {
    pub application_id: Option<Uuid>,
    pub applied: bool,
    pub pending: bool,
    pub decision: Option<String>,
    pub reason: Option<String>,
    pub decided_at: Option<String>,
}

pub async fn latest(tx: &mut Transaction<'_, Postgres>, workspace: &str) -> ApiResult<Latest> {
    Ok(sqlx::query_as(
        "SELECT a.id AS application_id, a.id IS NOT NULL AS applied, \
         (a.id IS NOT NULL AND (d.created_at IS NULL OR a.created_at > d.created_at)) \
           AS pending, \
         d.decision, d.reason, \
         to_char(d.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') \
           AS decided_at \
         FROM (SELECT 1) one \
         LEFT JOIN (SELECT id,created_at FROM marketplace.crm_market_applications \
               WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1) a ON true \
         LEFT JOIN (SELECT decision,reason,created_at \
                    FROM marketplace.crm_market_decisions \
                    WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1) d ON true",
    )
    .bind(workspace)
    .fetch_one(&mut **tx)
    .await?)
}

/// The state, from what the database says. A newer application always wins.
pub fn state(latest: &Latest) -> State {
    if latest.pending {
        return State::Pending;
    }
    match latest.decision.as_deref() {
        Some("approved") => State::Approved,
        Some("declined") => State::Declined,
        Some("revoked") => State::Revoked,
        _ if latest.applied => State::Pending,
        _ => State::NotApplied,
    }
}

/// The day a declined company may apply again, as the screen shows it.
pub fn can_apply_from(decided_at: Option<&str>) -> Option<String> {
    let at = OffsetDateTime::parse(decided_at?, &Rfc3339).ok()?;
    (at + WAIT).format(&Rfc3339).ok()
}

/// Whether the three-day wait after a decline has passed.
pub fn wait_over(decided_at: Option<&str>, now: OffsetDateTime) -> bool {
    match decided_at {
        None => true,
        Some(text) => OffsetDateTime::parse(text, &Rfc3339)
            .map(|at| now >= at + WAIT)
            .unwrap_or(false),
    }
}

/// The switch: on unless the company stored a row that says otherwise, with the version the
/// Admin's next change must repeat.
pub async fn enabled(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
) -> ApiResult<(bool, i64)> {
    let row: Option<(bool, i64)> = sqlx::query_as(
        "SELECT enabled,version FROM marketplace.crm_market_companies WHERE workspace_id=$1",
    )
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(row.unwrap_or((true, 0)))
}

/// What the member's Marketplace screen reads.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompanyStatus {
    pub state: State,
    pub enabled: bool,
    pub version: i64,
    pub can_apply_from: Option<String>,
    pub decline_reason: Option<String>,
    pub checklist: Value,
}

impl CompanyStatus {
    pub fn read(latest: &Latest, switch: (bool, i64), checklist: Value) -> Self {
        let muted = matches!(state(latest), State::Declined | State::Revoked);
        let declined = state(latest) == State::Declined;
        Self {
            state: state(latest),
            enabled: switch.0,
            version: switch.1,
            can_apply_from: declined
                .then(|| can_apply_from(latest.decided_at.as_deref()))
                .flatten(),
            decline_reason: muted.then(|| latest.reason.clone()).flatten(),
            checklist,
        }
    }
}
