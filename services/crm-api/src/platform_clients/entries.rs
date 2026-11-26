//! `POST /api/crm/platform/clients/{id}/timeline` with `{kind, body}`: a note, or a call or
//! message the person made themselves from their phone (nothing is sent from here). A note
//! needs text; a call or message may have none. The client moves up the list.
use super::{guard, input, model, rules, store, timeline};
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
use serde::Deserialize;
use serde_json::{json, Value};

const NOTE: &str = "Write the note.";

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EntryRequest {
    kind: String,
    #[serde(default)]
    body: Option<String>,
}

pub async fn log(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(id): Path<String>,
    request: Result<Json<EntryRequest>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let (mut tx, live) = guard::write(&state, &session, &headers).await?;
    let id = guard::id(&id)?;
    let Json(request) = request.map_err(|_| ApiError::invalid(model::KIND))?;
    let kind = model::logged(&request.kind).ok_or(ApiError::invalid(model::KIND))?;
    let body = rules::text(request.body, 4000, input::TEXT)?;
    if kind == "note" && body.is_none() {
        return Err(ApiError::invalid(NOTE));
    }
    store::hold(&mut tx, id).await?;
    let entry = timeline::append(&mut tx, id, kind, body.as_deref(), Some(live.id)).await?;
    store::touch(&mut tx, id).await?;
    let entry = timeline::one(&mut tx, entry).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "entry": entry }))))
}
