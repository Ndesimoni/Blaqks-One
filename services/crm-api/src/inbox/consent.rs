//! Agreement to WhatsApp messages (WhatsApp design WQ2, §3, §10 and §18). Insert-only rows
//! keyed by the client's canonical number; the latest row wins. The Admin and staff with
//! the WhatsApp grant record agreement given by phone, in person or on a form; any member
//! who can see the client records STOP on their behalf; only the Admin restores agreement
//! after STOP, with a written reason. Callers hold the workspace lock.
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use axum::http::StatusCode;
use serde_json::{json, Map, Value};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'a, 'b> = &'a mut Transaction<'b, Postgres>;

pub const INVALID: &str = "Choose agreed with a source, stopped, or restored with a reason.";
const REASON: &str = "Write the reason for restoring agreement, up to 500 characters.";

#[derive(Clone, Debug, FromRow)]
pub struct Consent {
    pub state: String,
    pub source: String,
    pub at: String,
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

/// The client's consent as the composer shows it.
pub fn view(consent: Option<&Consent>) -> Value {
    match consent {
        Some(found) => json!({"state": found.state, "source": found.source, "at": found.at}),
        None => json!({"state": "none", "source": null, "at": null}),
    }
}

pub async fn latest(tx: Tx<'_, '_>, workspace: &str, key: &str) -> ApiResult<Option<Consent>> {
    sqlx::query_as(
        "SELECT state,source,to_char(recorded_at AT TIME ZONE 'UTC', \
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

/// Applies `change` for the client number `key` and returns the consent now in force.
/// Repeating the current state writes nothing.
pub async fn record(
    tx: Tx<'_, '_>,
    workspace: &str,
    key: &str,
    user: &UserRow,
    change: Change,
) -> ApiResult<Option<Consent>> {
    let current = latest(tx, workspace, key).await?;
    let state = current.as_ref().map(|found| found.state.as_str());
    let admin = user.role == "admin";
    let (new_state, source, reason) = match change {
        Change::Agreed(_) if !admin && !user.channel_access.0.whatsapp => {
            return Err(ApiError::forbidden())
        }
        Change::Agreed(_) if state == Some("opt_out") => {
            return Err(ApiError(
                StatusCode::CONFLICT,
                "This client asked to stop messages. Only your Admin can restore agreement, with a reason.",
                "opted_out",
            ))
        }
        Change::Agreed(_) if state == Some("opt_in") => return Ok(current),
        Change::Agreed(source) => ("opt_in", source, None),
        Change::Stopped if state == Some("opt_out") => return Ok(current),
        Change::Stopped => ("opt_out", "recorded_stop", None),
        Change::Restored(_) if !admin => return Err(ApiError::forbidden()),
        Change::Restored(_) if state != Some("opt_out") => {
            return Err(ApiError(
                StatusCode::CONFLICT,
                "Agreement is restored only after the client asked to stop.",
                "not_stopped",
            ))
        }
        Change::Restored(reason) => ("opt_in", "admin_restored", Some(reason)),
    };
    sqlx::query(
        "INSERT INTO inbox.crm_inbox_consents \
           (id,workspace_id,channel,contact_key,state,source,reason,recorded_by) \
         VALUES ($1,$2,'whatsapp',$3,$4,$5,$6,$7)",
    )
    .bind(Uuid::new_v4())
    .bind(workspace)
    .bind(key)
    .bind(new_state)
    .bind(source)
    .bind(reason)
    .bind(user.id)
    .execute(&mut **tx)
    .await?;
    latest(tx, workspace, key).await
}

#[cfg(test)]
#[path = "consent_tests.rs"]
mod tests;
