//! `GET /chat/rooms/{id}/messages`: the latest 100, or those before `before`, with their
//! files and mentions. Sending is in `send.rs`.
use super::{access, wire};
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

const PAGE: i64 = 100;

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
    let messages = super::view::views(&mut tx, &rows).await?;
    tx.commit().await?;
    let more = messages.len() as i64 == PAGE;
    Ok(Json(json!({ "messages": messages, "more": more })))
}
