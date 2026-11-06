//! `POST /inbox/conversations/{id}/messages`: reply in a visible conversation. Email goes
//! through the caller's own mailbox, which must be the conversation's mailbox (O9);
//! WhatsApp goes from the caller's own number, which must be the conversation's (W1b).
use super::{content, email_text, files, same_mailbox, sender, store, whatsapp, BODY};
use crate::{
    auth::{profile::UserRow, session::Session},
    error::{ApiError, ApiResult},
    inbox::{
        access::{self, Viewer},
        draft_sent, events,
        read::load,
    },
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn reply(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    request: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    let id = access::id(&id)?;
    let Json(mut request) = request.map_err(|_| ApiError::invalid(BODY))?;
    let attachments = files::take(&mut request)?;
    let content = content(request)?;
    let mut tx = state.pool.begin().await?;
    // Live membership and grants are read after the workspace lock (H4).
    workspaces::lock(&mut tx, &workspace).await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let viewer = Viewer::of(&user);
    let row = load(&mut tx, &workspace, &viewer, id, true)
        .await?
        .ok_or_else(ApiError::missing)?;
    let message = match (row.channel.as_str(), content) {
        ("whatsapp", _) if !attachments.is_empty() => {
            return Err(ApiError::invalid(whatsapp::ATTACHMENTS))
        }
        ("whatsapp", content) => {
            whatsapp::send(&mut tx, &workspace, &user, id, content, None).await?
        }
        (_, whatsapp::Content::Text(text)) => {
            email(&mut tx, &workspace, &user, id, &text, &attachments).await?
        }
        (_, whatsapp::Content::Template(..)) => {
            return Err(ApiError::invalid("Templates are sent on WhatsApp only."))
        }
    };
    events::append(&mut tx, &workspace, id, Some(user.id), "replied").await?;
    // The writer's draft is emptied with the send (docs/saved-replies-drafts.md, H1).
    let draft = draft_sent::sent(&mut tx, &workspace, id, user.id).await?;
    tx.commit().await?;
    let sent = json!({ "message": message, "draftRevision": draft });
    Ok((StatusCode::CREATED, Json(sent)))
}

async fn email(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    user: &UserRow,
    id: Uuid,
    text: &str,
    attachments: &[Uuid],
) -> ApiResult<Value> {
    let text = email_text(text)?;
    let mailbox = sender(tx, workspace, user).await?;
    same_mailbox(&store::thread(tx, id).await?, mailbox)?;
    let mut message = store::queue(tx, workspace, id, user.id, &text, None).await?;
    let files = files::attach(tx, workspace, user.id, mailbox, &message, attachments);
    message["attachments"] = json!(files.await?);
    Ok(message)
}
