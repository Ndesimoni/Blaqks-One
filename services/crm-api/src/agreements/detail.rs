//! `GET /agreements/{id}` (docs/agreements-design.md §9, §13): the agreement with both
//! parties' names, the current revision, every revision the caller's company may see and
//! the redacted event log. Hidden, foreign and malformed IDs return the same not-found.
use super::{access, history, parties, store};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};

pub async fn read(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    access::ensure_reader(&state, &session, &workspace).await?;
    let id = access::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let row = store::load(&mut tx, id)
        .await?
        .filter(|row| access::can_read(row, &session, &workspace))
        .ok_or_else(ApiError::missing)?;
    let revision = store::current(&mut tx, id).await?;
    let sending = workspace == row.workspace_id;
    let revisions = history::revisions(&mut tx, id, sending).await?;
    let events = history::events(&mut tx, id, sending).await?;
    let agreement = parties::views(&mut tx, std::slice::from_ref(&row))
        .await?
        .pop()
        .ok_or_else(ApiError::missing)?;
    tx.commit().await?;
    let party = access::party_of(&row, session.user.id, &workspace).map(|party| party.as_str());
    Ok(Json(json!({
        "agreement": agreement,
        "revision": revision.view(),
        "revisions": revisions,
        "events": events,
        "party": party,
    })))
}
