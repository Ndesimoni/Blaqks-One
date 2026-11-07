//! Email attachments (F3a, docs/media-storage.md F3 design). A reply or Start message may
//! name up to 10 of the author's own pending uploads, 15 MiB in all; they are attached to
//! the new message in its own transaction, through company email only. Files are served
//! only after the conversation's own visibility check, and only as files of that message.
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    inbox::{
        access::{self, Viewer},
        read::load,
    },
    integrations::mail,
    media::{owned, serve, store::Item},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Response,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const KIND: &str = "inbox_message";
const MAX_FILES: usize = 10;
const MAX_BYTES: i64 = 15 * 1024 * 1024;
const LIST: &str = "Attach up to 10 different files you uploaded.";

/// Takes the optional `attachments` list out of a request body.
pub fn take(request: &mut Value) -> ApiResult<Vec<Uuid>> {
    let Some(list) = request
        .as_object_mut()
        .and_then(|map| map.remove("attachments"))
    else {
        return Ok(Vec::new());
    };
    let ids: Option<Vec<Uuid>> = list.as_array().and_then(|items| {
        items
            .iter()
            .map(|item| item.as_str().and_then(|text| Uuid::parse_str(text).ok()))
            .collect()
    });
    let ids = ids.ok_or(ApiError::invalid(LIST))?;
    let mut distinct = ids.clone();
    distinct.sort();
    distinct.dedup();
    if distinct.len() != ids.len() || ids.len() > MAX_FILES {
        return Err(ApiError::invalid(LIST));
    }
    Ok(ids)
}

/// Attaches the author's own pending uploads to the new message and returns their views.
pub async fn attach(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    author: Uuid,
    connection: Uuid,
    message: &Value,
    ids: &[Uuid],
) -> ApiResult<Vec<Value>> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    if !mail::takes_attachments(tx, workspace, connection).await? {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Attachments are sent through company email. This mailbox cannot send them yet.",
            "attachments_unsupported",
        ));
    }
    let owner = message["id"]
        .as_str()
        .and_then(|id| Uuid::parse_str(id).ok())
        .ok_or_else(ApiError::missing)?;
    let items = owned::attach(tx, workspace, author, ids, KIND, owner).await?;
    let total: i64 = items.iter().map(|item| i64::from(item.size)).sum();
    if total > MAX_BYTES {
        return Err(ApiError::invalid("Attach up to 15 MB of files in all."));
    }
    Ok(items.iter().map(Item::view).collect())
}

/// Each message view gains its attachments.
pub async fn views(
    tx: &mut Transaction<'_, Postgres>,
    ids: &[Uuid],
    messages: Vec<Value>,
) -> ApiResult<Vec<Value>> {
    let files = owned::list(tx, KIND, ids).await?;
    Ok(messages
        .into_iter()
        .zip(ids)
        .map(|(mut view, id)| {
            let attached: Vec<Value> = files
                .iter()
                .filter(|(owner, _)| owner == id)
                .map(|(_, item)| item.view())
                .collect();
            view["attachments"] = json!(attached);
            view
        })
        .collect())
}

/// `GET …/inbox/conversations/{id}/messages/{message}/files/{file}`; every refusal is 404.
pub async fn file(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id, message, file)): Path<(String, String, String, String)>,
) -> ApiResult<Response> {
    access::ensure_member(&state, &session, &workspace).await?;
    let (id, message, file) = (access::id(&id)?, access::id(&message)?, access::id(&file)?);
    let mut tx = state.pool.begin().await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    load(&mut tx, &workspace, &Viewer::of(&user), id, false)
        .await?
        .ok_or_else(ApiError::missing)?;
    let in_conversation: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM inbox.crm_inbox_messages \
         WHERE id=$1 AND conversation_id=$2 AND workspace_id=$3)",
    )
    .bind(message)
    .bind(id)
    .bind(&workspace)
    .fetch_one(&mut *tx)
    .await?;
    if !in_conversation {
        return Err(ApiError::missing());
    }
    let response = serve::file(&state, &mut tx, &workspace, KIND, message, file).await?;
    tx.commit().await?;
    Ok(response)
}
