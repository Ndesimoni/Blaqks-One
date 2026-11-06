//! `POST /inbox/conversations/{id}/messages/{message}/again`: Send again. Only the author,
//! only for a message that failed or whose outcome is unknown, and always as a new message
//! marked as a deliberate repeat; the old job and provider ID are never reused (design §5).
use super::{same_mailbox, sender, store, whatsapp};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    inbox::{
        access::{self, Viewer},
        events,
        read::load,
    },
    state::AppState,
    workspaces,
};
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};

type Original = (String, Option<String>, Option<Vec<String>>);

/// Failed, unknown, or left `sending` past two minutes (which reads as unknown).
pub const REPEATABLE: &str = "(m.status IN ('failed','unknown') OR (m.status='sending' \
    AND m.status_changed_at<now()-interval '2 minutes'))";

pub async fn again(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id, message)): Path<(String, String, String)>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    let id = access::id(&id)?;
    let message = access::id(&message)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    load(&mut tx, &workspace, &Viewer::of(&user), id, true)
        .await?
        .ok_or_else(ApiError::missing)?;
    let original: Option<Original> = sqlx::query_as(&format!(
        "SELECT m.body,m.template_sid,m.template_variables FROM inbox.crm_inbox_messages m \
         WHERE m.id=$1 AND m.conversation_id=$2 \
         AND m.direction='outbound' AND m.author_user_id=$3 AND {REPEATABLE} \
         AND NOT EXISTS (SELECT 1 FROM inbox.crm_inbox_messages r WHERE r.repeat_of=m.id)"
    ))
    .bind(message)
    .bind(id)
    .bind(user.id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((text, template, values)) = original else {
        return Err(ApiError::invalid(
            "Only your own failed message can be sent again, once.",
        ));
    };
    let thread = store::thread(&mut tx, id).await?;
    let repeat = if thread.channel == "whatsapp" {
        // The same text or the same template with the same values (W1b).
        let content = match (template, values) {
            (Some(sid), Some(values)) => whatsapp::Content::Template(sid, values),
            _ => whatsapp::Content::Text(text),
        };
        whatsapp::send(&mut tx, &workspace, &user, id, content, Some(message)).await?
    } else {
        let mailbox = sender(&mut tx, &workspace, &user).await?;
        same_mailbox(&thread, mailbox)?;
        store::queue(&mut tx, &workspace, id, user.id, &text, Some(message)).await?
    };
    events::append(&mut tx, &workspace, id, Some(user.id), "sent_again").await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "message": repeat }))))
}
