//! `GET /api/crm/platform/clients/{id}`: one live client in full with its newest timeline
//! entries, newest first.
use super::{guard, timeline, view};
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};

pub async fn read(
    State(state): State<AppState>,
    session: Session,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    let (mut tx, _) = guard::read(&state, &session).await?;
    let id = guard::id(&id)?;
    let client = view::full(&mut tx, id).await?;
    let timeline = timeline::list(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "client": client, "timeline": timeline })))
}
