use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::FromRow;

pub const ORGANISATION: &str = "super-admin-workspace";

pub async fn lock(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
) -> ApiResult<()> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
        .bind(workspace)
        .execute(&mut **transaction)
        .await?;
    Ok(())
}

#[derive(Serialize, FromRow)]
pub struct WorkspaceRow {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: String,
}

pub async fn ensure_access(state: &AppState, session: &Session, workspace: &str) -> ApiResult<()> {
    if session.user.role != "super-admin" && workspace != session.user.workspace_id {
        return Err(ApiError::forbidden());
    }
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM crm_workspaces WHERE id=$1)")
            .bind(workspace)
            .fetch_one(&state.pool)
            .await?;
    if !exists {
        return Err(ApiError::forbidden());
    }
    Ok(())
}

pub async fn ensure_writable(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    actor: uuid::Uuid,
    collection: Option<&str>,
) -> ApiResult<()> {
    let writable: bool = sqlx::query_scalar(
        "SELECT u.deleted_at IS NULL FROM crm_workspaces w JOIN crm_users u ON u.id=w.owner_id \
         WHERE w.id=$1",
    )
    .bind(workspace)
    .fetch_optional(&mut **transaction)
    .await?
    .unwrap_or(false);
    let user = sqlx::query_as::<_, crate::auth::profile::UserRow>(
        "SELECT * FROM crm_user_profiles WHERE id=$1 AND active AND owner_active",
    )
    .bind(actor)
    .fetch_optional(&mut **transaction)
    .await?;
    if !writable
        || user.is_none_or(|user| {
            (user.role != "super-admin" && user.workspace_id != workspace)
                || collection.is_some_and(|key| !user.can_collection(key))
        })
    {
        return Err(ApiError::forbidden());
    }
    Ok(())
}

pub async fn directory(State(state): State<AppState>, session: Session) -> ApiResult<Json<Value>> {
    let workspaces = sqlx::query_as::<_, WorkspaceRow>(
        "SELECT w.id, CASE WHEN w.id=$1 THEN 'Super Admin workspace' ELSE u.name END AS name, \
         CASE WHEN u.role='super-admin' THEN 'Super Admin' ELSE 'Admin' END AS role, \
         CASE WHEN u.deleted_at IS NOT NULL THEN 'archived' \
         WHEN u.active THEN 'active' ELSE 'inactive' END AS status \
         FROM crm_workspaces w JOIN crm_users u ON u.id=w.owner_id \
         WHERE $2 OR w.id=$3 ORDER BY w.created_at,w.id",
    )
    .bind(ORGANISATION)
    .bind(session.user.role == "super-admin")
    .bind(&session.user.workspace_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(json!({"workspaces": workspaces})))
}

#[derive(FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
struct Activity {
    id: uuid::Uuid,
    actor_id: uuid::Uuid,
    actor_name: String,
    workspace_id: String,
    action: String,
    collection: String,
    record_id: uuid::Uuid,
    timestamp: String,
}

pub async fn activity(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    ensure_access(&state, &session, &workspace).await?;
    if session.user.role == "staff" {
        return Err(ApiError::forbidden());
    }
    let activity = sqlx::query_as::<_, Activity>(
        "SELECT a.id,a.actor_id,u.name AS actor_name,a.workspace_id,a.action,a.collection,a.record_id, \
         to_char(a.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS timestamp \
         FROM crm_activity a JOIN crm_users u ON u.id=a.actor_id \
         WHERE a.workspace_id=$1 ORDER BY a.created_at DESC,a.id DESC LIMIT 100",
    ).bind(&workspace).fetch_all(&state.pool).await?;
    Ok(Json(json!({"activity": activity})))
}
