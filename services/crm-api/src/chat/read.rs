//! `POST /chat/rooms/{id}/read`: marks the room read for the caller.
use super::access;
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use uuid::Uuid;

pub async fn read(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, room)): Path<(String, String)>,
) -> ApiResult<StatusCode> {
    access::ensure(&state, &session, Some(&headers), &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let room = access::room(&mut tx, &workspace, user.id, &room, false).await?;
    mark(&mut tx, room.id, user.id).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn mark(tx: &mut access::Tx<'_>, room: Uuid, member: Uuid) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO chat.crm_chat_reads (room_id,member_id,read_at) VALUES ($1,$2,now()) \
         ON CONFLICT (room_id,member_id) DO UPDATE SET read_at=now()",
    )
    .bind(room)
    .bind(member)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
