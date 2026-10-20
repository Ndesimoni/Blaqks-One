//! `GET /chat`: the member's channels and direct conversations with unread counts, and the
//! colleagues they can message; `GET /chat/summary`: the total unread for the sidebar.
//! Every company's #general channel is created the first time anyone opens chat.
use super::access::{self, Tx, VISIBLE};
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

/// Unread messages in room `r` for member `$2`: others' live messages after their mark.
const UNREAD: &str = "(SELECT count(*) FROM chat.crm_chat_messages m WHERE m.room_id=r.id \
    AND m.author_id<>$2 AND m.deleted_at IS NULL AND m.created_at>coalesce((SELECT x.read_at \
    FROM chat.crm_chat_reads x WHERE x.room_id=r.id AND x.member_id=$2),'-infinity'))";

#[derive(FromRow)]
struct Row {
    id: Uuid,
    kind: String,
    name: Option<String>,
    peer: Option<Uuid>,
    last_message_at: Option<String>,
    unread: i64,
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
        "SELECT r.id,r.kind,r.name, \
           (SELECT p.member_id FROM chat.crm_chat_participants p \
            WHERE p.room_id=r.id AND p.member_id<>$2 LIMIT 1) AS peer, \
           to_char(r.last_message_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') \
             AS last_message_at, {UNREAD} AS unread \
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
            json!({"id": row.id, "kind": row.kind, "name": row.name, "peerId": row.peer,
                "lastMessageAt": row.last_message_at, "unread": row.unread})
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

pub async fn summary(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    access::ensure(&state, &session, None, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let unread: i64 = sqlx::query_scalar(&format!(
        "SELECT coalesce(sum({UNREAD}),0)::bigint FROM chat.crm_chat_rooms r WHERE {VISIBLE}"
    ))
    .bind(&workspace)
    .bind(user.id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "unread": unread })))
}
