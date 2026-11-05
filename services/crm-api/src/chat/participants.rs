//! `POST /chat/rooms/{id}/participants` (C3 follow-up): the group's creator, or a company
//! Admin already in it, adds live same-company colleagues (owner, 2026-10-22). Anyone who
//! cannot see the group gets not-found; other participants are refused. The whole access
//! expansion is serialized under the company lock and commits atomically.
use super::{access, group_input::colleagues, wire};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
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

const INVALID: &str = "Choose available colleagues in your company.";
const FULL: &str = "This group can have at most 21 people.";
const ADDS_PER_HOUR: i64 = 20;

pub async fn add(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, room)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::ensure(&state, &session, Some(&headers), &workspace).await?;
    let map = wire::fields(body, &["memberIds"], &[], INVALID)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let actor = access::live(&mut tx, &workspace, session.user.id).await?;
    let target = access::room(&mut tx, &workspace, actor.id, &room, true).await?;
    if target.kind != "group" {
        return Err(ApiError::invalid(INVALID));
    }
    if target.created_by != actor.id && actor.role != "admin" {
        return Err(ApiError::forbidden());
    }
    let requested = colleagues(map.get("memberIds"), actor.id, 1..=20, INVALID)?;
    let valid: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM crm_user_profiles WHERE id=ANY($1) \
        AND workspace_id=$2 AND active AND owner_active AND role<>'super-admin'",
    )
    .bind(&requested)
    .bind(&workspace)
    .fetch_one(&mut *tx)
    .await?;
    if valid != requested.len() as i64 {
        return Err(ApiError::invalid(INVALID));
    }
    let current: Vec<Uuid> =
        sqlx::query_scalar("SELECT member_id FROM chat.crm_chat_participants WHERE room_id=$1")
            .bind(target.id)
            .fetch_all(&mut *tx)
            .await?;
    let added: Vec<Uuid> = requested
        .into_iter()
        .filter(|id| !current.contains(id))
        .collect();
    if added.is_empty() {
        return Err(ApiError::conflict(
            "Refresh the group and choose someone new.",
        ));
    }
    if current.len() + added.len() > 21 {
        return Err(ApiError::conflict(FULL));
    }
    let recent: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM chat.crm_chat_group_adds WHERE \
        workspace_id=$1 AND actor_id=$2 AND created_at>now()-interval '1 hour'",
    )
    .bind(&workspace)
    .bind(actor.id)
    .fetch_one(&mut *tx)
    .await?;
    if recent >= ADDS_PER_HOUR {
        return Err(ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            "You have added people to many groups. Wait a while and try again.",
            "chat_rate_limited",
        ));
    }
    sqlx::query(
        "INSERT INTO chat.crm_chat_participants (room_id,member_id) SELECT $1,unnest($2::uuid[])",
    )
    .bind(target.id)
    .bind(&added)
    .execute(&mut *tx)
    .await?;
    sqlx::query("DELETE FROM chat.crm_chat_mentions WHERE room_id=$1 AND member_id=ANY($2)")
        .bind(target.id)
        .bind(&added)
        .execute(&mut *tx)
        .await?;
    // The whole history is readable, but nothing before joining counts as unread.
    sqlx::query(
        "INSERT INTO chat.crm_chat_reads (room_id,member_id,read_at) \
         SELECT $1,unnest($2::uuid[]),now() \
         ON CONFLICT (room_id,member_id) DO UPDATE SET read_at=EXCLUDED.read_at",
    )
    .bind(target.id)
    .bind(&added)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO chat.crm_chat_group_adds (id,workspace_id,actor_id) VALUES ($1,$2,$3)",
    )
    .bind(Uuid::new_v4())
    .bind(&workspace)
    .bind(actor.id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "added": added })))
}
