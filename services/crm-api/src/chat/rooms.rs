//! `GET /chat`: the member's channels, groups and direct conversations with unread and
//! mention counts, and the colleagues they can message (totals in `counts.rs`). Every
//! company's #general channel is created the first time anyone opens chat.
use super::{
    access::{self, Tx, VISIBLE},
    counts::{MENTIONS, UNREAD},
};
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow)]
struct Row {
    id: Uuid,
    kind: String,
    name: Option<String>,
    title: Option<String>,
    created_by: Uuid,
    peer: Option<Uuid>,
    /// A group's participants, the caller included; colleagues who left the company stay.
    members: Option<Vec<Uuid>>,
    last_message_at: Option<String>,
    unread: i64,
    mentions: i64,
}

#[derive(FromRow)]
struct Person {
    id: Uuid,
    name: String,
}

async fn general(tx: &mut Tx<'_>, workspace: &str, member: Uuid) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO chat.crm_chat_rooms (id,workspace_id,kind,name,created_by) \
         VALUES ($1,$2,'channel','general',$3) \
         ON CONFLICT (workspace_id,name) WHERE kind='channel' DO NOTHING",
    )
    .bind(Uuid::new_v4())
    .bind(workspace)
    .bind(member)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    access::ensure(&state, &session, None, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    general(&mut tx, &workspace, user.id).await?;
    let rows: Vec<Row> = sqlx::query_as(&format!(
        "SELECT r.id,r.kind,r.name,r.title,r.created_by, \
           (SELECT p.member_id FROM chat.crm_chat_participants p WHERE r.kind='direct' \
            AND p.room_id=r.id AND p.member_id<>$2 LIMIT 1) AS peer, \
           CASE WHEN r.kind='group' THEN ARRAY(SELECT p.member_id \
             FROM chat.crm_chat_participants p WHERE p.room_id=r.id ORDER BY p.member_id) \
           END AS members, \
           to_char(r.last_message_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') \
             AS last_message_at, {UNREAD} AS unread, {MENTIONS} AS mentions \
         FROM chat.crm_chat_rooms r WHERE {VISIBLE} \
         ORDER BY r.kind,r.name NULLS LAST,r.last_message_at DESC NULLS LAST"
    ))
    .bind(&workspace)
    .bind(user.id)
    .fetch_all(&mut *tx)
    .await?;
    let people: Vec<Person> = sqlx::query_as(
        "SELECT id,name FROM crm_user_profiles WHERE workspace_id=$1 AND active \
         AND owner_active AND role<>'super-admin' AND id<>$2 ORDER BY name,id",
    )
    .bind(&workspace)
    .bind(user.id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let rooms: Vec<Value> = rows
        .iter()
        .map(|row| {
            json!({"id": row.id, "kind": row.kind, "name": row.name, "title": row.title,
                "createdBy": row.created_by,
                "peerId": row.peer, "members": row.members,
                "lastMessageAt": row.last_message_at, "unread": row.unread,
                "mentions": row.mentions})
        })
        .collect();
    let people: Vec<Value> = people
        .iter()
        .map(|person| json!({"id": person.id, "name": person.name}))
        .collect();
    Ok(Json(json!({
        "rooms": rooms,
        "people": people,
        "canCreateChannel": user.role == "admin",
    })))
}
