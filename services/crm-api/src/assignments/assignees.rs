use super::requests;
use crate::{
    auth::{grants::Action, profile::UserRow, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AssigneeQuery {
    collection: Option<String>,
}

/// `GET /workspaces/{ws}/assignees?collection=` (M5): the approved teammates for one
/// assignable collection, as `{id, name}` only. Active, owner-active staff of the
/// workspace holding the grant, plus the workspace owner (so the Super Admin appears
/// only in the organisation workspace).
pub async fn assignees(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    query: Result<Query<AssigneeQuery>, axum::extract::rejection::QueryRejection>,
) -> ApiResult<Json<Value>> {
    workspaces::ensure_access(&state, &session, &workspace).await?;
    let collection = query
        .ok()
        .and_then(|Query(query)| query.collection)
        .unwrap_or_default();
    requests::ensure_assignable(&collection)?;
    if !session.user.can_collection(&collection) {
        return Err(ApiError::forbidden());
    }
    // L-5: only callers who can hand records on (or see the whole team) list assignees.
    if !session.user.can(&collection, Action::Assign) && !session.user.has_team_scope() {
        return Err(Action::Assign.denied());
    }
    let members = sqlx::query_as::<_, UserRow>(
        "SELECT p.* FROM crm_user_profiles p WHERE p.active AND p.owner_active AND \
         ((p.role='staff' AND p.workspace_id=$1) \
         OR (p.workspace_id=$1 AND p.id=(SELECT owner_id FROM crm_workspaces WHERE id=$1))) \
         ORDER BY p.name,p.id",
    )
    .bind(&workspace)
    .fetch_all(&state.pool)
    .await?;
    let assignees: Vec<Value> = members
        .into_iter()
        .filter(|member| member.can_collection(&collection))
        .map(|member| json!({"id": member.id, "name": member.name}))
        .collect();
    Ok(Json(json!({ "assignees": assignees })))
}
