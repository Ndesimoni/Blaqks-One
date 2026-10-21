//! Photos and files in team chat (packet F1). Uploads go to `media`; a message attaches the
//! sender's own pending uploads in its transaction. `GET /chat/rooms/{room}/messages/
//! {message}/files/{file}` serves one only to members who may see that room.
use super::{access, messages::Message};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    media::{owned, serve},
    state::AppState,
};
use axum::{extract::Path, extract::State, response::Response};
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const KIND: &str = "chat";

/// Message views with their attachments, in one query for the whole page.
pub async fn views(
    tx: &mut Transaction<'_, Postgres>,
    messages: &[Message],
) -> ApiResult<Vec<Value>> {
    let ids: Vec<Uuid> = messages.iter().map(|message| message.id).collect();
    let files = owned::list(tx, KIND, &ids).await?;
    Ok(messages
        .iter()
        .map(|message| {
            let mut view = message.view();
            let attached: Vec<Value> = files
                .iter()
                .filter(|(owner, _)| *owner == message.id)
                .map(|(_, item)| item.view())
                .collect();
            view["attachments"] = Value::Array(attached);
            view
        })
        .collect())
}

pub async fn file(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, room, message, file)): Path<(String, String, String, String)>,
) -> ApiResult<Response> {
    access::ensure(&state, &session, None, &workspace).await?;
    let parse = |value: &str| Uuid::parse_str(value).map_err(|_| ApiError::missing());
    let (message, file) = (parse(&message)?, parse(&file)?);
    let mut tx = state.pool.begin().await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let room = access::room(&mut tx, &workspace, user.id, &room, false).await?;
    let in_room: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM chat.crm_chat_messages \
         WHERE id=$1 AND room_id=$2 AND deleted_at IS NULL)",
    )
    .bind(message)
    .bind(room.id)
    .fetch_one(&mut *tx)
    .await?;
    if !in_room {
        return Err(ApiError::missing());
    }
    let response = serve::file(&state, &mut tx, &workspace, KIND, message, file).await?;
    tx.commit().await?;
    Ok(response)
}
