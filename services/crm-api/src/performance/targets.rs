//! `GET /performance/targets?month=YYYY-MM` returns the month's targets this caller may see;
//! `PUT /performance/targets` sets or clears one (Admin only, 403 before any 400).
use super::{access, errors, input, rows, store, visibility};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{
        rejection::{JsonRejection, QueryRejection},
        Path, Query, State,
    },
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MonthQuery {
    month: String,
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    query: Result<Query<MonthQuery>, QueryRejection>,
) -> ApiResult<Json<Value>> {
    access::reader(&state, &session, &workspace).await?;
    let Query(query) = query.map_err(|_| ApiError::invalid(errors::MONTH))?;
    let month = input::month(&query.month)?;
    let rows = rows::month(&state.pool, &workspace, &month).await?;
    let viewer = &session.user;
    let targets: Vec<Value> = rows
        .iter()
        .filter(|row| {
            row.metric()
                .is_some_and(|metric| visibility::visible(viewer, row.member_id, metric))
        })
        .map(rows::TargetRow::view)
        .collect();
    Ok(Json(json!({"month": month, "targets": targets,
        "canEdit": visibility::can_edit(viewer, &workspace)})))
}

pub async fn save(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::manager(&state, &session, &headers, &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(errors::INVALID))?;
    let input = input::parse(body)?;
    let saved = store::save(&state.pool, session.user.id, &workspace, input).await?;
    Ok(Json(
        json!({"target": saved.as_ref().map(rows::TargetRow::view)}),
    ))
}
