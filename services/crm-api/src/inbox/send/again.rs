//! `POST /inbox/conversations/{id}/messages/{message}/again`: Send again. Only the author,
//! only for a message that failed or whose outcome is unknown, and always as a new message
//! marked as a deliberate repeat; the old job and provider ID are never reused (design §5).
use super::{same_mailbox, sender, store};
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
    let original: Option<String> = sqlx::query_scalar(&format!(
        "SELECT m.body FROM inbox.crm_inbox_messages m WHERE m.id=$1 AND m.conversation_id=$2 \
         AND m.direction='outbound' AND m.author_user_id=$3 AND {REPEATABLE} \
         AND NOT EXISTS (SELECT 1 FROM inbox.crm_inbox_messages r WHERE r.repeat_of=m.id)"
    ))
    .bind(message)
    .bind(id)
    .bind(user.id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(text) = original else {
        return Err(ApiError::invalid(
            "Only your own failed message can be sent again, once.",
        ));
    };
    let mailbox = sender(&mut tx, &workspace, &user).await?;
    same_mailbox(&store::thread(&mut tx, id).await?, mailbox)?;
    let repeat = store::queue(&mut tx, &workspace, id, user.id, &text, Some(message)).await?;
    events::append(&mut tx, &workspace, id, Some(user.id), "sent_again").await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "message": repeat }))))
}
