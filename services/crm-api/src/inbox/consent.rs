//! Agreement to WhatsApp messages (WhatsApp design WQ2, §3, §10 and §18). Insert-only rows
//! keyed by the client's canonical number; the latest row wins. The Admin and staff with
//! the WhatsApp grant record agreement given by phone, in person or on a form; any member
//! who can see the client records STOP on their behalf; only the Admin restores agreement
//! after STOP, with a written reason. Callers hold the workspace lock.
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use serde_json::{json, Map, Value};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

pub use super::consent_record::{record, Via};

pub(super) type Tx<'a, 'b> = &'a mut Transaction<'b, Postgres>;

pub const INVALID: &str = "Choose agreed with a source, stopped, or restored with a reason.";
const REASON: &str = "Write the reason for restoring agreement, up to 500 characters.";

#[derive(Clone, Debug, FromRow)]
pub struct Consent {
    pub state: String,
    pub source: String,
    pub at: String,
    pub recorded_by: Option<Uuid>,
}

#[derive(Debug, PartialEq)]
pub enum Change {
    Agreed(&'static str),
    Stopped,
    Restored(String),
}

/// `{change, source}`, `{change}` or `{change, reason}`, with no other key.
pub fn parse(map: &Map<String, Value>) -> ApiResult<Change> {
    let text = |key: &str| map.get(key).and_then(Value::as_str);
    let change = match (text("change"), map.len()) {
        (Some("agreed"), 2) => match text("source") {
            Some("phone") => Change::Agreed("phone"),
            Some("in_person") => Change::Agreed("in_person"),
            Some("form") => Change::Agreed("form"),
            _ => return Err(ApiError::invalid(INVALID)),
        },
        (Some("stopped"), 1) => Change::Stopped,
        (Some("restored"), 2) if map.contains_key("reason") => {
            let reason = text("reason")
                .map(str::trim)
                .filter(|reason| (1..=500).contains(&reason.chars().count()))
                .filter(|reason| !reason.contains('\0'))
                .ok_or(ApiError::invalid(REASON))?;
            Change::Restored(reason.to_owned())
        }
        _ => return Err(ApiError::invalid(INVALID)),
    };
    Ok(change)
}

/// The client's consent as `user` may see it. Everyone sees the state; how and when it
/// was recorded only the Admin, team-scope staff and the member who recorded it, so an
/// assigned-only member cannot learn about a colleague's client (W1b review L2).
pub fn view(consent: Option<&Consent>, user: &UserRow) -> Value {
    let full =
        consent.is_some_and(|found| user.has_team_scope() || found.recorded_by == Some(user.id));
    shown(consent, full)
}

pub fn shown(consent: Option<&Consent>, full: bool) -> Value {
    match consent {
        Some(found) if full => {
            json!({"state": found.state, "source": found.source, "at": found.at})
        }
        Some(found) => json!({"state": found.state, "source": null, "at": null}),
        None => json!({"state": "none", "source": null, "at": null}),
    }
}

pub async fn latest(tx: Tx<'_, '_>, workspace: &str, key: &str) -> ApiResult<Option<Consent>> {
    sqlx::query_as(
        "SELECT state,source,recorded_by,to_char(recorded_at AT TIME ZONE 'UTC', \
           'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS at FROM inbox.crm_inbox_consents \
         WHERE workspace_id=$1 AND channel='whatsapp' AND contact_key=$2 \
         ORDER BY recorded_at DESC,id DESC LIMIT 1",
    )
    .bind(workspace)
    .bind(key)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

#[cfg(test)]
#[path = "consent_tests.rs"]
mod tests;
