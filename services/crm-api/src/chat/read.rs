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

/// Written only while the room is still visible to the member, so a read racing a leave
/// cannot bring the mark back (C3 review L3).
pub async fn mark(tx: &mut access::Tx<'_>, room: Uuid, member: Uuid) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO chat.crm_chat_reads (room_id,member_id,read_at) \
         SELECT r.id,$2,now() FROM chat.crm_chat_rooms r WHERE r.id=$1 AND (r.kind='channel' \
           OR EXISTS (SELECT 1 FROM chat.crm_chat_participants p \
             WHERE p.room_id=r.id AND p.member_id=$2)) \
         ON CONFLICT (room_id,member_id) DO UPDATE SET read_at=now()",
    )
    .bind(room)
    .bind(member)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
