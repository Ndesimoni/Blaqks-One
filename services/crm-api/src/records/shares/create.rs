//! Creates a pending one-record offer after live sender and receiver checks.
use super::{access, locks, rules, store, view::Caller};
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateRequest {
    collection: String,
    record_id: String,
    to_id: String,
}

pub async fn create(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<CreateRequest>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::writer(&state, &session, &headers, &workspace).await?;
    let Json(body) =
        body.map_err(|_| crate::error::ApiError::invalid("Provide a record and colleague."))?;
    let record = access::id(&body.record_id)?;
    let to = Uuid::parse_str(&body.to_id)
        .map_err(|_| crate::error::ApiError::denied(rules::RECEIVER))?;
    let mut tx = state.pool.begin().await?;
    let live = access::live(&mut tx, &workspace, session.user.id).await?;
    let target = rules::shareable(&mut tx, &workspace, &live, (&body.collection, record)).await?;
    locks::members(&mut tx, &[live.id, to]).await?;
    if !rules::receivable(
        &mut tx,
        &workspace,
        (&body.collection, target),
        (live.id, to),
    )
    .await?
    {
        return Err(crate::error::ApiError::denied(rules::RECEIVER));
    }
    store::expire_stale(&mut tx, record, to).await?;
    if store::open_exists(&mut tx, record, to).await? {
        return Err(crate::error::ApiError::conflict(
            "This record is already shared with that colleague.",
        ));
    }
    let id = store::insert(
        &mut tx,
        (&workspace, record, &body.collection),
        (live.id, to),
    )
    .await?;
    let scope = (!live.has_team_scope()).then_some(live.id);
    let row = store::find(&mut tx, &workspace, scope, id, false)
        .await?
        .ok_or_else(crate::error::ApiError::missing)?;
    let share = row.view(Caller::of(&live, &workspace));
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({"share": share}))))
}
