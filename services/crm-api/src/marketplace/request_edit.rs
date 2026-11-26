//! `PATCH …/marketplace/requests/{id}` (packet MK2): the poster edits their own open request with
//! the version they last saw. The expiry date does not move; Renew is its own command.
use super::{events, gate, limits, request, request_view, requests, requests_edit, sources};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State as AxumState},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

pub const STALE: &str = "Your request changed elsewhere. Reload and try again.";
pub const CLOSED: &str = "This request is closed.";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Edit {
    pub expected_version: i64,
    pub request: request::Input,
}

pub async fn edit(
    AxumState(state): AxumState<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Edit>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let Json(edit) = body.map_err(|_| ApiError::invalid(request::INVALID))?;
    let request_id = limits::missing_id(&id)?;
    let mut tx = state.pool.begin().await?;
    let user = gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, user.id).await?;
    let valid = request::validate(edit.request)?;
    sqlx::query("SELECT id FROM marketplace.crm_market_requests WHERE id=$1 FOR UPDATE")
        .bind(request_id)
        .execute(&mut *tx)
        .await?;
    let existing = requests::own_row(&mut tx, request_id, user.id).await?;
    if existing.paused_at.is_some()
        || super::answer_access::active_count(&mut tx, request_id).await? > 0
    {
        return Err(ApiError::conflict(
            "Close active offers before changing this request.",
        ));
    }
    if existing.closed_at.is_some() {
        return Err(ApiError::conflict(CLOSED));
    }
    let Some(row) =
        requests_edit::edit(&mut tx, request_id, user.id, edit.expected_version, &valid).await?
    else {
        return Err(ApiError::stale(STALE));
    };
    events::append(&mut tx, &workspace, user.id, user.id, "request_edited").await?;
    let client = sources::client_of(&mut tx, row.id).await?;
    tx.commit().await?;
    Ok((
        StatusCode::OK,
        Json(json!({ "request": request_view::mine(&row, client, None) })),
    ))
}
