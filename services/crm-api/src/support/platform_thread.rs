//! One request on the Blaqks One side: `GET /api/crm/platform/help/{id}` reads it with its
//! thread; `POST …/{id}/messages` answers (Waiting for the member, assigned to whoever answers
//! first); `PATCH …/{id}` solves or reopens it and assigns it.
use super::{events, guard, input, platform, store, view};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    platform_metrics::names,
    state::AppState,
    workspaces::platform::Level,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

pub async fn read(
    State(state): State<AppState>,
    session: Session,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    let (mut tx, _) = guard::team(&state, &session, None, Level::View).await?;
    let id = input::id(&id)?;
    let row = view::one(&mut tx, id).await?;
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
    Path(id): Path<String>,
    body: Result<Json<input::Reply>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let (mut tx, live) = guard::team(&state, &session, Some(&headers), Level::Manage).await?;
    let id = input::id(&id)?;
    let Json(body) = body.map_err(|_| ApiError::invalid("Write your answer."))?;
    let text = input::body(&body.body)?;
    let locked = store::lock(&mut tx, id).await?;
    store::insert_message(&mut tx, id, live.id, "platform", &text).await?;
    store::set_state(&mut tx, id, "waiting", true).await?;
    if view::one(&mut tx, id).await?.assignee().is_none() {
        store::assign(&mut tx, id, Some(live.id)).await?;
    }
    events::record(
        &mut tx,
        names::HELP_REQUEST_ANSWERED,
        &locked.workspace_id,
        &live.role,
    )
    .await?;
    let row = view::one(&mut tx, id).await?;
    let request = view::shaped(&mut tx, std::slice::from_ref(&row))
        .await?
        .remove(0);
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "request": request }))))
}

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: Result<Json<input::Change>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let (mut tx, live) = guard::team(&state, &session, Some(&headers), Level::Manage).await?;
    let id = input::id(&id)?;
    let Json(change) = body.map_err(|_| ApiError::invalid("Provide the change and version."))?;
    let locked = store::lock(&mut tx, id).await?;
    if locked.version != change.version {
        return Err(ApiError::conflict(
            "This request changed. Reload it and try again.",
        ));
    }
    if let Some(next) = change.state.as_deref() {
        if !["solved", "open"].contains(&next) {
            return Err(ApiError::invalid("Choose Solved or Open."));
        }
        if next != locked.state {
            store::set_state(&mut tx, id, next, false).await?;
            if next == "solved" {
                events::record(
                    &mut tx,
                    names::HELP_REQUEST_SOLVED,
                    &locked.workspace_id,
                    &live.role,
                )
                .await?;
            }
        }
    }
    if let Some(raw) = change.assignee_id.as_deref() {
        let assignee = match raw {
            "" => None,
            raw => Some(Uuid::parse_str(raw).map_err(|_| ApiError::invalid(NOT_HELPER))?),
        };
        if let Some(person) = assignee {
            let helpers = platform::helpers(&mut tx).await?;
            if !helpers.iter().any(|helper| helper.id == person) {
                return Err(ApiError::invalid(NOT_HELPER));
            }
        }
        store::assign(&mut tx, id, assignee).await?;
    }
    let row = view::one(&mut tx, id).await?;
    let request = view::shaped(&mut tx, std::slice::from_ref(&row))
        .await?
        .remove(0);
    tx.commit().await?;
    Ok(Json(json!({ "request": request })))
}

const NOT_HELPER: &str =
    "Assign the request to someone on the Blaqks One team who answers help requests.";
