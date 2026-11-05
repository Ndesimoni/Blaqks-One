//! `PATCH /chat/rooms/{id}/messages/{message}` (the author edits; the message shows as
//! edited) and `DELETE` (the author, or the Admin in a channel, removes the text; the
//! message keeps its place as "deleted"). The Admin never touches direct conversations.
//! An edit may replace the message's mentions (C3); a deletion removes them.
use super::{
    access, mentions,
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
    let map = wire::fields(body, &["body"], &["mentions"], wire::BODY)?;
    let text = wire::text(&map)?;
    let mentioned = map
        .contains_key("mentions")
        .then(|| mentions::parse(&map))
        .transpose()?;
    let message = message_id(&message)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let room = access::room(&mut tx, &workspace, user.id, &room, false).await?;
    if let Some(ids) = &mentioned {
        mentions::check(&mut tx, &workspace, &room, ids).await?;
    }
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
    if let Some(ids) = mentioned {
        mentions::store(&mut tx, room.id, edited.id, &ids).await?;
    }
    let view = super::view::views(&mut tx, std::slice::from_ref(&edited)).await?;
    tx.commit().await?;
    Ok(Json(json!({ "message": view[0] })))
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
    // Its photos, files and mentions go with it.
    crate::media::owned::remove(&mut tx, super::files::KIND, removed.id).await?;
    mentions::store(&mut tx, room.id, removed.id, &[]).await?;
    tx.commit().await?;
    Ok(Json(json!({ "message": removed.view() })))
}
