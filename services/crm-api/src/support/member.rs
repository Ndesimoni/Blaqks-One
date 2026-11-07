//! The member's side: `GET` and `POST /api/crm/workspaces/{workspace}/help` list and open
//! their own help requests; `GET …/help/summary` counts requests with unread answers.
use super::{events, guard, input, store, view};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    platform_metrics::names,
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    let (mut tx, live) = guard::member(&state, &session, None, &workspace).await?;
    let rows = view::mine(&mut tx, &workspace, live.id).await?;
    let requests = view::shaped(&mut tx, &rows).await?;
    tx.commit().await?;
    Ok(Json(json!({ "requests": requests })))
}

pub async fn summary(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    let (mut tx, live) = guard::member(&state, &session, None, &workspace).await?;
    let rows = view::mine(&mut tx, &workspace, live.id).await?;
    tx.commit().await?;
    let unread = rows
        .iter()
        .filter(|row| view::shape(row, None)["unread"] == true)
        .count();
    Ok(Json(json!({ "unread": unread })))
}

/// Opens a request with its first message; Blaqks One sees it at once as Open.
pub async fn create(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<input::NewRequest>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let (mut tx, live) = guard::member(&state, &session, Some(&headers), &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid("Describe what you need help with."))?;
    let category = input::category(&body.category)?;
    let subject = input::subject(&body.subject)?;
    let message = input::body(&body.message)?;
    let id = store::insert_request(&mut tx, &workspace, live.id, category, &subject).await?;
    store::insert_message(&mut tx, id, live.id, "member", &message).await?;
    events::record(&mut tx, names::HELP_REQUEST_OPENED, &workspace, &live.role).await?;
    let row = view::one(&mut tx, id).await?;
    let request = view::shaped(&mut tx, std::slice::from_ref(&row))
        .await?
        .remove(0);
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "request": request }))))
}
