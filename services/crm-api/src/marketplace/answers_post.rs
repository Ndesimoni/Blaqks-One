//! Offers derive the recipient from a live request; clients cannot choose recipients.
use super::{answer_access, answers_send::Context, gate, limits};
use crate::{
    agreements::listings::{self, ShareInput},
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Input {
    record_id: String,
    preview_digest: String,
    checked: bool,
}

pub async fn post(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    Json(input): Json<Input>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let id = limits::missing_id(&id)?;
    let record = limits::missing_id(&input.record_id)?;
    let mut tx = state.pool.begin().await?;
    let live = gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, live.id).await?;
    let request = answer_access::request(&mut tx, id).await?;
    if request.workspace_id == workspace {
        return Err(ApiError::missing());
    }
    let offer = ShareInput {
        record,
        to_workspace: request.workspace_id,
        to: request.member_id,
        view_ends: request.expires_at,
        exact: true,
        note: None,
        preview: input.preview_digest,
        checked: input.checked,
    };
    let context = Context {
        request: id,
        record,
        version: request.version,
    };
    tx.rollback().await?;
    listings::send_marketplace(state, live.id, workspace, offer, Some(context)).await
}
