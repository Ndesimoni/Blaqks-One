//! `PATCH /api/crm/platform/clients/{id}`: an edit at the version the person opened (409
//! when older). Only the named fields change. A new stage adds a `stage` entry ("New →
//! Contacted") and its platform event; a new owner adds an `assigned` entry. Assigning
//! someone checks they may hold clients; keeping the current owner never does.
use super::{events, guard, input, model, owners, store, timeline, view};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: Result<Json<input::Body>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let (mut tx, live) = guard::write(&state, &session, &headers).await?;
    let id = guard::id(&id)?;
    let Json(body) = body.map_err(|_| ApiError::invalid("Provide the version and changes."))?;
    let version = body
        .version
        .ok_or(ApiError::invalid("Provide the version you opened."))?;
    let before = store::locked(&mut tx, id, version).await?;
    let after = before.clone().apply(body)?;
    if after == before {
        let client = view::full(&mut tx, id).await?;
        tx.commit().await?;
        return Ok(Json(json!({ "client": client })));
    }
    let assigned = match after.owner_id {
        Some(owner) if after.owner_id != before.owner_id => {
            Some(owners::check(&mut tx, owner).await?)
        }
        _ => None,
    };
    store::update(&mut tx, id, &after).await?;
    if after.stage != before.stage {
        let change = model::stage_change(&before.stage, &after.stage);
        timeline::append(&mut tx, id, "stage", Some(&change), Some(live.id)).await?;
        events::stage_changed(&mut tx, &after.stage, Some(&live.role)).await?;
    }
    if after.owner_id != before.owner_id {
        let text = match assigned {
            Some(name) => format!("Assigned to {name}"),
            None => "Unassigned".to_string(),
        };
        timeline::append(&mut tx, id, "assigned", Some(&text), Some(live.id)).await?;
    }
    let client = view::full(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "client": client })))
}
