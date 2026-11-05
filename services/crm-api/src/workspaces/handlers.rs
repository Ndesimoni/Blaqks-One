use super::ORGANISATION;
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{extract::State, Json};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::FromRow;

#[derive(Serialize, FromRow)]
pub struct WorkspaceRow {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: String,
}

/// The caller's own workspace only (BO1a item 3): no one switches into another company,
/// Blaqks One included. The organisation is labelled "Blaqks One".
pub async fn directory(State(state): State<AppState>, session: Session) -> ApiResult<Json<Value>> {
    let workspaces = sqlx::query_as::<_, WorkspaceRow>(
        "SELECT w.id, CASE WHEN w.id=$1 THEN 'Blaqks One' \
         ELSE COALESCE(c.display_name,u.name) END AS name, \
         CASE WHEN u.role='super-admin' THEN 'Blaqks One' ELSE 'Admin' END AS role, \
         CASE WHEN u.deleted_at IS NOT NULL THEN 'archived' \
         WHEN u.active THEN 'active' ELSE 'inactive' END AS status \
         FROM crm_workspaces w JOIN crm_users u ON u.id=w.owner_id \
         LEFT JOIN crm_company_profiles c ON c.workspace_id=w.id \
         WHERE w.id=$2 ORDER BY w.created_at,w.id",
    )
    .bind(ORGANISATION)
    .bind(&session.user.workspace_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(json!({"workspaces": workspaces})))
}
