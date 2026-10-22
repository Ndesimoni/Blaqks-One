//! `GET /finance/handovers/waiting` → `{answer, approve}` (agreements design §17,
//! amendment 17): the caller's own counts for the Deals badge. `answer` counts pending
//! offers to them; `approve` counts acceptances waiting for them as the chosen approver
//! with the Approve right, or every waiting one of the company for its Admin. Expired
//! offers are left out; the Super Admin gets none.
use super::gate::{self, Need};
use crate::{agreements::handover, auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use std::collections::HashSet;
use uuid::Uuid;

pub async fn waiting(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    gate::reader(&state, &session, &workspace, Need::Module).await?;
    let user = &session.user;
    if user.workspace_id != workspace || !matches!(user.role.as_str(), "staff" | "admin") {
        return Ok(Json(json!({"answer": 0, "approve": 0})));
    }
    let access = user.finance_access();
    let mut tx = state.pool.begin().await?;
    let rows: Vec<(String, Option<Uuid>)> = sqlx::query_as(
        "SELECT status,agreement_id FROM crm_deal_handovers WHERE workspace_id=$1 \
         AND ((status='pending' AND to_id=$2) OR (status='awaiting_approval' \
         AND ($3 OR (approver_id=$2 AND $4))))",
    )
    .bind(&workspace)
    .bind(user.id)
    .bind(access.manage)
    .bind(access.approve)
    .fetch_all(&mut *tx)
    .await?;
    let ids: Vec<Uuid> = rows.iter().filter_map(|(_, id)| *id).collect();
    let expired: HashSet<Uuid> = match ids.is_empty() {
        true => HashSet::new(),
        false => handover::deadlines(&mut tx, &ids)
            .await?
            .into_iter()
            .filter(|(_, _, expired)| *expired)
            .map(|(id, _, _)| id)
            .collect(),
    };
    tx.commit().await?;
    let live = |id: &Option<Uuid>| id.is_none_or(|id| !expired.contains(&id));
    let count = |status: &str| {
        rows.iter()
            .filter(|(at, id)| at == status && live(id))
            .count()
    };
    Ok(Json(
        json!({"answer": count("pending"), "approve": count("awaiting_approval")}),
    ))
}
