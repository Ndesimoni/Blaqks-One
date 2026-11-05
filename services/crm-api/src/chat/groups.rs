//! `POST /chat/groups` (packet C3): any member starts a private group with 2–20 live
//! colleagues of the same company, with an optional name. Only its participants may read or
//! post: the Admin cannot open a group they are not in, and the Super Admin reads none.
use super::{
    access,
    group_input::{members, title, MEMBERS},
    wire,
};
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

const GROUPS_PER_HOUR: i64 = 20;

pub async fn create(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::ensure(&state, &session, Some(&headers), &workspace).await?;
    let map = wire::fields(body, &["memberIds"], &["name"], MEMBERS)?;
    let ids = members(map.get("memberIds"), session.user.id)?;
    let title = title(map.get("name"))?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    // Every chosen colleague must be a live member of the same company now.
    let colleagues: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM crm_user_profiles WHERE id=ANY($1) AND workspace_id=$2 \
         AND active AND owner_active AND role<>'super-admin'",
    )
    .bind(&ids)
    .bind(&workspace)
    .fetch_one(&mut *tx)
    .await?;
    if colleagues != ids.len() as i64 {
        return Err(ApiError::invalid(MEMBERS));
    }
    let recent: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM chat.crm_chat_rooms WHERE workspace_id=$1 AND created_by=$2 \
         AND kind='group' AND created_at>now()-interval '1 hour'",
    )
    .bind(&workspace)
    .bind(user.id)
    .fetch_one(&mut *tx)
    .await?;
    if recent >= GROUPS_PER_HOUR {
        return Err(ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            "You have started many groups. Wait a while and try again.",
            "chat_rate_limited",
        ));
    }
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO chat.crm_chat_rooms (id,workspace_id,kind,title,created_by) \
         VALUES ($1,$2,'group',$3,$4)",
    )
    .bind(id)
    .bind(&workspace)
    .bind(&title)
    .bind(user.id)
    .execute(&mut *tx)
    .await?;
    let mut everyone = ids;
    everyone.push(user.id);
    everyone.sort();
    sqlx::query(
        "INSERT INTO chat.crm_chat_participants (room_id,member_id) \
         SELECT $1,unnest($2::uuid[])",
    )
    .bind(id)
    .bind(&everyone)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    let room = json!({"id": id, "kind": "group", "name": null, "title": title,
        "createdBy": user.id, "peerId": null,
        "members": everyone, "unread": 0, "mentions": 0});
    Ok((StatusCode::CREATED, Json(json!({ "room": room }))))
}
