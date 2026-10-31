//! `POST /chat/rooms/{id}/messages`: text, up to 10 photos or files, and in channels and
//! groups up to 20 mentions. At most 30 messages a minute per member (review C1 L1).
use super::{
    access, mentions,
    messages::{Message, COLUMNS},
    wire,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    media::owned,
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

const SENDS_PER_MINUTE: i64 = 30;

pub async fn send(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, room)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::ensure(&state, &session, Some(&headers), &workspace).await?;
    let map = wire::fields(body, &["body"], &["attachments", "mentions"], wire::BODY)?;
    let (text, files) = wire::outgoing(&map)?;
    let mentioned = mentions::parse(&map)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let room = access::room(&mut tx, &workspace, user.id, &room, true).await?;
    // Each send holds the company's write lock, so one member may not flood (review C1 L1).
    let recent: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM chat.crm_chat_messages \
         WHERE author_id=$1 AND created_at>now()-interval '1 minute'",
    )
    .bind(user.id)
    .fetch_one(&mut *tx)
    .await?;
    if recent >= SENDS_PER_MINUTE {
        return Err(ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            "You are sending too fast. Wait a moment and try again.",
            "chat_rate_limited",
        ));
    }
    mentions::check(&mut tx, &workspace, &room, &mentioned).await?;
    let message: Message = sqlx::query_as(&format!(
        "INSERT INTO chat.crm_chat_messages AS m (id,room_id,workspace_id,author_id,body) \
         VALUES ($1,$2,$3,$4,$5) RETURNING {COLUMNS},{} AS at",
        wire::STAMP
    ))
    .bind(Uuid::new_v4())
    .bind(room.id)
    .bind(&workspace)
    .bind(user.id)
    .bind(&text)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("UPDATE chat.crm_chat_rooms SET last_message_at=now() WHERE id=$1")
        .bind(room.id)
        .execute(&mut *tx)
        .await?;
    if !files.is_empty() {
        owned::attach(
            &mut tx,
            &workspace,
            user.id,
            &files,
            super::files::KIND,
            message.id,
        )
        .await?;
    }
    if !mentioned.is_empty() {
        mentions::store(&mut tx, room.id, message.id, &mentioned).await?;
    }
    super::read::mark(&mut tx, room.id, user.id).await?;
    let view = super::view::views(&mut tx, std::slice::from_ref(&message)).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "message": view[0] }))))
}
