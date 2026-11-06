//! Recording a change of consent (W1b, design §10 and §18): one insert-only row with who
//! recorded it and where (a record or a conversation, W1b review L2), under the caller's
//! workspace lock. Repeating the state already in force writes nothing.
use super::consent::{latest, Change, Consent, Tx};
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use axum::http::StatusCode;
use uuid::Uuid;

/// Where a member recorded the change.
#[derive(Clone, Copy)]
pub enum Via<'a> {
    Record(&'a str, Uuid),
    Conversation(Uuid),
}

/// Applies `change` for the client number `key` and returns the consent now in force.
/// Repeating the current state writes nothing.
pub async fn record(
    tx: Tx<'_, '_>,
    workspace: &str,
    key: &str,
    user: &UserRow,
    change: Change,
    via: Via<'_>,
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
    let (collection, record, conversation) = match via {
        Via::Record(collection, id) => (Some(collection), Some(id), None),
        Via::Conversation(id) => (None, None, Some(id)),
    };
    sqlx::query(
        "INSERT INTO inbox.crm_inbox_consents (id,workspace_id,channel,contact_key,state, \
           source,reason,recorded_by,via_collection,via_record_id,via_conversation_id) \
         VALUES ($1,$2,'whatsapp',$3,$4,$5,$6,$7,$8,$9,$10)",
    )
    .bind(Uuid::new_v4())
    .bind(workspace)
    .bind(key)
    .bind(new_state)
    .bind(source)
    .bind(reason)
    .bind(user.id)
    .bind(collection)
    .bind(record)
    .bind(conversation)
    .execute(&mut **tx)
    .await?;
    latest(tx, workspace, key).await
}
