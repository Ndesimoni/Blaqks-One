//! `PATCH /chat/rooms/{id}/messages/{message}` (the author edits; the message shows as
//! edited) and `DELETE` (the author, or the Admin in a channel, removes the text; the
//! message keeps its place as "deleted"). The Admin never touches direct conversations.
use super::{
    access,
    messages::{Message, COLUMNS},
    wire,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

type Item = Path<(String, String, String)>;

fn message_id(value: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(value).map_err(|_| ApiError::missing())
}

pub async fn edit(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, room, message)): Item,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::ensure(&state, &session, Some(&headers), &workspace).await?;
    let text = wire::text(&wire::exact(body, &["body"], wire::BODY)?)?;
    let message = message_id(&message)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let room = access::room(&mut tx, &workspace, user.id, &room, false).await?;
    let edited: Option<Message> = sqlx::query_as(&format!(
        "UPDATE chat.crm_chat_messages m SET body=$4,edited_at=now() \
         WHERE m.id=$1 AND m.room_id=$2 AND m.author_id=$3 AND m.deleted_at IS NULL \
         RETURNING {COLUMNS},{} AS at",
        wire::STAMP
    ))
    .bind(message)
    .bind(room.id)
    .bind(user.id)
    .bind(&text)
    .fetch_optional(&mut *tx)
    .await?;
    let edited = edited.ok_or_else(ApiError::missing)?;
    tx.commit().await?;
    Ok(Json(json!({ "message": edited.view() })))
}

pub async fn delete(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, room, message)): Item,
) -> ApiResult<Json<Value>> {
    access::ensure(&state, &session, Some(&headers), &workspace).await?;
    let message = message_id(&message)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let room = access::room(&mut tx, &workspace, user.id, &room, false).await?;
    // The Admin may remove anyone's message in a channel, never in a direct conversation.
    let moderator = user.role == "admin" && room.kind == "channel";
    let removed: Option<Message> = sqlx::query_as(&format!(
        "UPDATE chat.crm_chat_messages m SET body='',deleted_at=now() \
         WHERE m.id=$1 AND m.room_id=$2 AND (m.author_id=$3 OR $4) AND m.deleted_at IS NULL \
         RETURNING {COLUMNS},{} AS at",
        wire::STAMP
    ))
    .bind(message)
    .bind(room.id)
    .bind(user.id)
    .bind(moderator)
    .fetch_optional(&mut *tx)
    .await?;
    let removed = removed.ok_or_else(ApiError::missing)?;
    tx.commit().await?;
    Ok(Json(json!({ "message": removed.view() })))
}
