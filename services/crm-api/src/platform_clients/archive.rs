//! `DELETE /api/crm/platform/clients/{id}` with `{version}`: archives the client at the
//! version the person reviewed. It leaves every list and read; its row and timeline stay.
use super::{guard, store};
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
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ArchiveRequest {
    version: i64,
}

pub async fn archive(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: Result<Json<ArchiveRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let (mut tx, _) = guard::write(&state, &session, &headers).await?;
    let id = guard::id(&id)?;
    let Json(request) = body.map_err(|_| ApiError::invalid("Provide the version you reviewed."))?;
    store::locked(&mut tx, id, request.version).await?;
    store::archive(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "archived": true })))
}
