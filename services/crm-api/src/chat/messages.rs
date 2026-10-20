//! `GET /chat/rooms/{id}/messages` (the latest 100, or those before `before`), `POST` to
//! send (at most 30 a minute per member).
use super::{access, wire};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

const PAGE: i64 = 100;
const SENDS_PER_MINUTE: i64 = 30;

#[derive(FromRow)]
pub struct Message {
    pub id: Uuid,
    pub author_id: Uuid,
    pub body: String,
    pub at: String,
    pub edited: bool,
    pub deleted: bool,
}

impl Message {
    pub fn view(&self) -> Value {
        json!({"id": self.id, "authorId": self.author_id, "body": self.body, "at": self.at,
            "edited": self.edited, "deleted": self.deleted})
    }
}

pub const COLUMNS: &str = "m.id,m.author_id,m.body,m.edited_at IS NOT NULL AS edited, \
    m.deleted_at IS NOT NULL AS deleted";

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Page {
    /// A message ID: return the page before it.
    before: Option<Uuid>,
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, room)): Path<(String, String)>,
    Query(page): Query<Page>,
) -> ApiResult<Json<Value>> {
    access::ensure(&state, &session, None, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let room = access::room(&mut tx, &workspace, user.id, &room, false).await?;
    let rows: Vec<Message> = sqlx::query_as(&format!(
        "SELECT * FROM (SELECT {COLUMNS},{} AS at,m.created_at FROM chat.crm_chat_messages m \
           WHERE m.room_id=$1 AND ($2::uuid IS NULL OR (m.created_at,m.id) < \
             (SELECT b.created_at,b.id FROM chat.crm_chat_messages b \
              WHERE b.id=$2 AND b.room_id=$1)) \
           ORDER BY m.created_at DESC,m.id DESC LIMIT $3) page ORDER BY created_at,id",
        wire::STAMP
    ))
    .bind(room.id)
    .bind(page.before)
    .bind(PAGE)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let messages: Vec<Value> = rows.iter().map(Message::view).collect();
    let more = messages.len() as i64 == PAGE;
    Ok(Json(json!({ "messages": messages, "more": more })))
}

pub async fn send(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, room)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::ensure(&state, &session, Some(&headers), &workspace).await?;
    let text = wire::text(&wire::exact(body, &["body"], wire::BODY)?)?;
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
    super::read::mark(&mut tx, room.id, user.id).await?;
    tx.commit().await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({ "message": message.view() })),
    ))
}
