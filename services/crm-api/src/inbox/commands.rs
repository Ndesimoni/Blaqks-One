//! `PATCH /inbox/conversations/{id}`: change the state (open, waiting, resolved) and/or
//! the assignee with `expectedVersion`, under the workspace lock with the live member.
//! Managers and whole-team staff assign anyone in the team; assigned-only staff may only
//! claim an Unassigned conversation or release their own (design §11).
use super::{
    access::{self, Viewer},
    events,
    read::load,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

pub const INVALID: &str = "Provide a valid conversation change.";
pub const ASSIGNEE: &str = "Choose an active member of this team.";
const RELOAD: &str = "Reload the conversation and try again.";
const STATES: [&str; 3] = ["open", "waiting", "resolved"];

/// The requested change: `assignee` is `Some(None)` to unassign.
#[derive(Debug, PartialEq)]
pub struct Change {
    pub version: i64,
    pub state: Option<String>,
    pub assignee: Option<Option<Uuid>>,
}

pub fn parse(body: Value) -> ApiResult<Change> {
    let Value::Object(map) = body else {
        return Err(ApiError::invalid(INVALID));
    };
    let known = ["expectedVersion", "state", "assigneeId"];
    if map.keys().any(|key| !known.contains(&key.as_str())) || map.len() < 2 {
        return Err(ApiError::invalid(INVALID));
    }
    let version = map
        .get("expectedVersion")
        .and_then(Value::as_i64)
        .filter(|version| *version > 0)
        .ok_or(ApiError::invalid(INVALID))?;
    let state = match map.get("state") {
        None => None,
        Some(Value::String(state)) if STATES.contains(&state.as_str()) => Some(state.clone()),
        Some(_) => return Err(ApiError::invalid(INVALID)),
    };
    let assignee = match map.get("assigneeId") {
        None => None,
        Some(Value::Null) => Some(None),
        Some(Value::String(id)) => Some(Some(
            Uuid::parse_str(id).map_err(|_| ApiError::invalid(ASSIGNEE))?,
        )),
        Some(_) => return Err(ApiError::invalid(INVALID)),
    };
    Ok(Change {
        version,
        state,
        assignee,
    })
}

/// Whether `viewer` may move the conversation from `current` to `next`.
pub fn may_assign(viewer: &Viewer, current: Option<Uuid>, next: Option<Uuid>) -> bool {
    viewer.caller.is_none()
        || (current.is_none() && next == Some(viewer.id))
        || (current == Some(viewer.id) && next.is_none())
}

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    let id = access::id(&id)?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let change = parse(body)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let viewer = Viewer::of(&access::live(&mut tx, &workspace, session.user.id).await?);
    let row = load(&mut tx, &workspace, &viewer, id, true)
        .await?
        .ok_or_else(ApiError::missing)?;
    if row.version != change.version {
        return Err(ApiError::stale(RELOAD));
    }
    let next_state = change.state.clone().unwrap_or_else(|| row.state.clone());
    let next_assignee = change.assignee.unwrap_or(row.assignee_id);
    if next_assignee != row.assignee_id {
        if !may_assign(&viewer, row.assignee_id, next_assignee) {
            return Err(ApiError::forbidden());
        }
        if let Some(target) = next_assignee {
            let member = workspaces::member(&mut tx, &workspace, target)
                .await
                .map_err(|_| ApiError::invalid(ASSIGNEE))?;
            if member.role == "super-admin" {
                return Err(ApiError::invalid(ASSIGNEE));
            }
        }
        events::append(&mut tx, &workspace, id, Some(viewer.id), "assigned").await?;
    }
    if next_state != row.state {
        events::append(&mut tx, &workspace, id, Some(viewer.id), "state_changed").await?;
    }
    sqlx::query(
        "UPDATE inbox.crm_inbox_conversations SET state=$2,assignee_id=$3, \
           version=version+1,updated_at=now() WHERE id=$1",
    )
    .bind(id)
    .bind(&next_state)
    .bind(next_assignee)
    .execute(&mut *tx)
    .await?;
    // An assigned-only member who released it can no longer see it; answer with the change.
    let after = load(&mut tx, &workspace, &viewer, id, false).await?;
    tx.commit().await?;
    Ok(Json(json!({"conversation": after.map(|row| row.view())})))
}

#[cfg(test)]
#[path = "commands_tests.rs"]
mod tests;
