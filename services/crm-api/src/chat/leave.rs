//! `POST /chat/rooms/{id}/leave` (packet C3): a participant leaves a group. Their messages
//! keep their place; they lose the room, its read mark and their mentions in it at once.
//! Channels and direct conversations cannot be left.
use super::access;
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};

const GROUPS_ONLY: &str = "Only a group can be left.";

pub async fn leave(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, room)): Path<(String, String)>,
) -> ApiResult<StatusCode> {
    access::ensure(&state, &session, Some(&headers), &workspace).await?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let room = access::room(&mut tx, &workspace, user.id, &room, true).await?;
    if room.kind != "group" {
        return Err(ApiError::invalid(GROUPS_ONLY));
    }
    for table in [
        "chat.crm_chat_participants",
        "chat.crm_chat_reads",
        "chat.crm_chat_mentions",
    ] {
        sqlx::query(&format!(
            "DELETE FROM {table} WHERE room_id=$1 AND member_id=$2"
        ))
        .bind(room.id)
        .bind(user.id)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}
