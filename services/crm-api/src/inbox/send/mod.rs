//! Email sending from the Inbox (packet E1b, design §5). A person replies, starts a
//! conversation or sends a failed message again; each queues one message and one outbox
//! job in the same transaction, and the messaging worker sends it through the author's own
//! mailbox (decision O9). Bodies never leave this module except to the provider.
mod again;
pub mod domain;
mod domain_settle;
mod reply;
mod start;
mod store;

pub use again::again;
pub use reply::reply;
pub use start::start;

use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
    integrations::mail,
};
use axum::http::StatusCode;
use serde_json::{Map, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const BODY: &str = "Write a message of up to 20,000 characters.";
pub const SUBJECT: &str = "Write a subject of up to 200 characters on one line.";

/// The message text from `key`: trimmed at the ends, 1–20,000 characters.
pub fn body(map: &Map<String, Value>, key: &str) -> ApiResult<String> {
    map.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty() && text.chars().count() <= 20_000)
        .map(str::to_owned)
        .ok_or(ApiError::invalid(BODY))
}

pub fn object(body: Value, keys: &[&str], message: &'static str) -> ApiResult<Map<String, Value>> {
    let Value::Object(map) = body else {
        return Err(ApiError::invalid(message));
    };
    let exact = map.len() == keys.len() && keys.iter().all(|key| map.contains_key(*key));
    exact.then_some(map).ok_or(ApiError::invalid(message))
}

fn conflict(message: &'static str, code: &'static str) -> ApiError {
    ApiError(StatusCode::CONFLICT, message, code)
}

/// The connection the caller sends through: the Admin or staff with the email grant only.
pub async fn sender(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    user: &UserRow,
) -> ApiResult<Uuid> {
    if user.role != "admin" && !user.channel_access.0.email {
        return Err(ApiError::forbidden());
    }
    // A SendGrid company sends from each member's own address on its domain (E3b).
    match mail::company_sender(tx, workspace, user.id).await? {
        Some(Some(connection)) => return Ok(connection),
        Some(None) => {
            return Err(conflict(
                "Ask your Admin for a sending address on the company email before sending.",
                "address_required",
            ))
        }
        None => {}
    }
    mail::sending_mailbox(tx, workspace, user.id)
        .await?
        .ok_or(conflict(
            "Connect your Google mailbox before sending email.",
            "mailbox_required",
        ))
}

/// Replies and repeats go only through the mailbox the conversation belongs to (O9).
pub fn same_mailbox(thread: &store::Thread, mailbox: Uuid) -> ApiResult<()> {
    if thread.channel != "email" {
        return Err(ApiError::invalid(
            "Sending on this channel is not available yet.",
        ));
    }
    if thread.connection_id != mailbox {
        return Err(conflict(
            "Only the owner of this mailbox can reply by email.",
            "other_mailbox",
        ));
    }
    if thread.state == "spam" || thread.blocked {
        return Err(conflict(
            "This sender is blocked or marked as spam.",
            "not_sendable",
        ));
    }
    Ok(())
}
