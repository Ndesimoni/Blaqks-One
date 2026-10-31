//! `GET /finance/assignees` (finance-design §5.4, §13 L-F8): members who can hold deals —
//! active staff with the finance module and the workspace owner — for callers who can
//! hand deals on or see team finance. `kind` lets the hand-over picker list staff only.
use super::{
    gate::{self, Need},
    handover_checks,
};
use crate::{
    auth::{grants::Action, profile::UserRow, session::Session},
    error::ApiResult,
    state::AppState,
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};

pub async fn assignees(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    gate::reader(&state, &session, &workspace, Need::Module).await?;
    let access = session.user.finance_access();
    if !access.assign && !access.team_view {
        return Err(Action::Assign.denied());
    }
    let members = sqlx::query_as::<_, UserRow>(
        "SELECT p.* FROM crm_user_profiles p WHERE p.active AND p.owner_active \
         AND p.workspace_id=$1 AND (p.role='staff' \
         OR p.id=(SELECT owner_id FROM crm_workspaces WHERE id=$1)) ORDER BY p.name,p.id",
    )
    .bind(&workspace)
    .fetch_all(&state.pool)
    .await?;
    let assignees: Vec<Value> = members
        .into_iter()
        .filter(|member| member.effective_permissions().finance)
        .map(|member| {
            let kind = if member.role == "staff" {
                "staff"
            } else {
                "owner"
            };
            json!({"id": member.id, "name": member.name, "kind": kind})
        })
        .collect();
    Ok(Json(json!({ "assignees": assignees })))
}

/// `GET /finance/approvers` (agreements design §17, amendment 13): who may approve a
/// hand-over the caller sends — the company's Admin and active staff with the Finance
/// Approve right, without the caller. Names and IDs only; the offer checks again.
pub async fn approvers(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    gate::reader(&state, &session, &workspace, Need::Assign).await?;
    let members = sqlx::query_as::<_, UserRow>(
        "SELECT p.* FROM crm_user_profiles p WHERE p.active AND p.owner_active \
         AND p.workspace_id=$1 AND p.role IN ('staff','admin') AND p.id<>$2 \
         ORDER BY p.role='staff',p.name,p.id",
    )
    .bind(&workspace)
    .bind(session.user.id)
    .fetch_all(&state.pool)
    .await?;
    let approvers: Vec<Value> = members
        .into_iter()
        .filter(|member| handover_checks::eligible(member, &workspace))
        .map(|member| json!({"id": member.id, "name": member.name}))
        .collect();
    Ok(Json(json!({ "approvers": approvers })))
}
