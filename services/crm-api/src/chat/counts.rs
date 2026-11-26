//! Unread messages and unread mentions per room for member `$2`, and `GET /chat/summary`
//! (the totals for the sidebar badge). Both count others' live messages after the member's
//! read mark, so reading the room clears them.
use super::access::{self, VISIBLE};
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};

/// Unread messages in room `r` for member `$2`.
pub const UNREAD: &str = "(SELECT count(*) FROM chat.crm_chat_messages m WHERE m.room_id=r.id \
    AND m.author_id<>$2 AND m.deleted_at IS NULL AND m.created_at>coalesce((SELECT x.read_at \
    FROM chat.crm_chat_reads x WHERE x.room_id=r.id AND x.member_id=$2),'-infinity'))";

/// Unread messages in room `r` that mention member `$2` (packet C3).
pub const MENTIONS: &str = "(SELECT count(*) FROM chat.crm_chat_mentions n \
    JOIN chat.crm_chat_messages m ON m.id=n.message_id WHERE n.room_id=r.id \
    AND n.member_id=$2 AND m.author_id<>$2 AND m.deleted_at IS NULL \
    AND m.created_at>coalesce((SELECT x.read_at FROM chat.crm_chat_reads x \
    WHERE x.room_id=r.id AND x.member_id=$2),'-infinity'))";

pub async fn summary(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    access::ensure(&state, &session, None, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let (unread, mentions): (i64, i64) = sqlx::query_as(&format!(
        "SELECT coalesce(sum({UNREAD}),0)::bigint,coalesce(sum({MENTIONS}),0)::bigint \
         FROM chat.crm_chat_rooms r WHERE {VISIBLE}"
    ))
    .bind(&workspace)
    .bind(user.id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "unread": unread, "mentions": mentions })))
}
