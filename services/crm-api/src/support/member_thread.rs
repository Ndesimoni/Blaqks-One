//! One of the member's own requests: `GET …/help/{id}` reads the thread (and marks it read);
//! `POST …/help/{id}/messages` replies, which reopens it for Blaqks One. Another person's or
//! another company's request is not found.
use super::{guard, input, store, view};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};

pub async fn read(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    let (mut tx, live) = guard::member(&state, &session, None, &workspace).await?;
    let id = input::id(&id)?;
    let row = view::one(&mut tx, id).await?;
    if row.workspace_id != workspace || row.requester_id != live.id {
        return Err(ApiError::missing());
    }
    store::mark_read(&mut tx, id).await?;
    let request = view::shaped(&mut tx, std::slice::from_ref(&row))
        .await?
        .remove(0);
    let messages = view::messages(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "request": request, "messages": messages })))
}

pub async fn reply(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<input::Reply>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let (mut tx, live) = guard::member(&state, &session, Some(&headers), &workspace).await?;
    let id = input::id(&id)?;
    let Json(body) = body.map_err(|_| ApiError::invalid("Write your reply."))?;
    let text = input::body(&body.body)?;
    let locked = store::lock(&mut tx, id).await?;
    if locked.workspace_id != workspace || locked.requester_id != live.id {
        return Err(ApiError::missing());
    }
    if locked.closed {
        return Err(ApiError::conflict(
            "This request was solved more than 30 days ago. Open a new request instead.",
        ));
    }
    store::insert_message(&mut tx, id, live.id, "member", &text).await?;
    store::set_state(&mut tx, id, "open", false).await?;
    store::mark_read(&mut tx, id).await?;
    let row = view::one(&mut tx, id).await?;
    let request = view::shaped(&mut tx, std::slice::from_ref(&row))
        .await?
        .remove(0);
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "request": request }))))
}
