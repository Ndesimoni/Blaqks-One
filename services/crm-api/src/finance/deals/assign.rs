//! `PUT /finance/deals/{id}/assignee {version, assigneeId|null, reason}` (§13 H-F1):
//! moving a deal between people or to/from the queue is Admin-only and needs a reason.
//! Staff hand on their own deals through hand-over requests.
use super::{
    gate::{self, Need, STALE},
    holder::{self, Move},
    links, list, row,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    finance::{errors::INELIGIBLE, wire},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

const INVALID: &str = "Provide a version, an assignee and a reason.";
pub const SHARES: &str = "This team member already shares this deal. Change the split first.";

pub async fn assign(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace, Need::Manage).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let body = wire::exact(body, &["version", "assigneeId", "reason"], INVALID)?;
    let version = gate::version(&body["version"])?;
    let to = match &body["assigneeId"] {
        Value::Null => None,
        value => Some(wire::uuid(value, INELIGIBLE)?),
    };
    let reason = gate::reason(&body["reason"])?;
    let id = gate::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, Need::Manage).await?;
    let deal = row::locked(&mut tx, &workspace, &live, id).await?;
    if deal.version != version {
        return Err(ApiError::stale(STALE));
    }
    if let Some(member) = to {
        if !links::finance_member(&mut tx, &workspace, member, false).await? {
            return Err(ApiError::invalid(INELIGIBLE));
        }
        if !deal.earned() && deal.second_agent_id == Some(member) {
            return Err(ApiError::conflict(SHARES));
        }
    }
    if deal.assignee_id != to {
        let change = Move {
            workspace: &workspace,
            deal: &deal,
            to,
            actor: live.id,
            history: "reassigned",
            reason: &reason,
            referral: None,
            requested_by: None,
        };
        holder::apply(&mut tx, change).await?;
    }
    let entry = list::entry(&mut tx, &workspace, &live, id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "entry": entry })))
}
