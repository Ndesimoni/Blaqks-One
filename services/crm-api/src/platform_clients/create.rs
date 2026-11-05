//! `POST /api/crm/platform/clients`: a team member with clients at Manage adds a client by
//! hand. It starts its timeline with a `created` entry and records the platform event.
use super::{events, guard, input, owners, store, timeline, view};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};

pub async fn create(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    body: Result<Json<input::Body>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let (mut tx, live) = guard::write(&state, &session, &headers).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid("Provide the client's details."))?;
    if body.version.is_some() {
        return Err(ApiError::invalid("A new client has no version."));
    }
    let fields = input::Fields::fresh().apply(body)?;
    if let Some(owner) = fields.owner_id {
        owners::check(&mut tx, owner).await?;
    }
    let id = store::insert(&mut tx, &fields, Some(live.id)).await?;
    timeline::append(&mut tx, id, "created", None, Some(live.id)).await?;
    events::created(&mut tx, &fields.source, Some(&live.role)).await?;
    let client = view::full(&mut tx, id).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "client": client }))))
}
