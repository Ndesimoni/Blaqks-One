pub use super::list::list;
use super::{
    creation, deletion,
    mutation::{self, Entry, Update},
    requests::{CreateRequest, DeleteRequest, UpdateRequest},
    validation,
    visibility::RecordScope,
};
use crate::{
    auth::{grants::Action, protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::ensure_access,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

pub async fn create(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, collection)): Path<(String, String)>,
    body: Result<Json<CreateRequest>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Entry>)> {
    ensure_access(&state, &session, &workspace).await?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    ensure_collection(&session, &collection, Action::Create)?;
    let Json(body) = body.map_err(|_| ApiError::invalid("Provide a JSON record."))?;
    let record = validation::validate_new(&collection, body.record)?;
    creation::ensure_id_allowed(RecordScope::of(&session.user), &record)?;
    let entry = creation::create(
        &state.pool,
        session.user.id,
        &workspace,
        &collection,
        record,
    )
    .await?;
    Ok((StatusCode::CREATED, Json(entry)))
}

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, collection, id)): Path<(String, String, String)>,
    body: Result<Json<UpdateRequest>, JsonRejection>,
) -> ApiResult<Json<Entry>> {
    ensure_access(&state, &session, &workspace).await?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    ensure_collection(&session, &collection, Action::Edit)?;
    let Json(body) = body.map_err(|_| ApiError::invalid("Provide a JSON record and version."))?;
    if body.version < 1 {
        return Err(ApiError::invalid("A positive record version is required."));
    }
    let record = validation::validate(&collection, body.record)?;
    let id = Uuid::parse_str(&id).map_err(|_| ApiError::invalid("Invalid server record ID."))?;
    let entry = mutation::update(
        &state.pool,
        Update {
            actor: session.user.id,
            workspace: &workspace,
            collection: &collection,
            id,
            version: body.version,
            record,
        },
    )
    .await?;
    Ok(Json(entry))
}

pub async fn delete(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, collection, id)): Path<(String, String, String)>,
    body: Result<Json<DeleteRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    ensure_access(&state, &session, &workspace).await?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    // Step 2 absorbs H2: parents need team scope, deleteMain and coverage (M-C).
    ensure_collection(&session, &collection, Action::Delete)?;
    let Json(body) = body.map_err(|_| ApiError::invalid("Provide a JSON record version."))?;
    if body.version < 1 {
        return Err(ApiError::invalid("A positive record version is required."));
    }
    validation::collection_key(&collection)?;
    let id = Uuid::parse_str(&id).map_err(|_| ApiError::invalid("Invalid server record ID."))?;
    deletion::delete(
        &state.pool,
        session.user.id,
        &workspace,
        &collection,
        id,
        body.version,
    )
    .await?;
    Ok(Json(json!({"ok": true})))
}

/// Steps 1–2 after access: an unknown collection is a path-only 400 (I-1), then the
/// module grant and the action, from the session profile, before any body or target.
fn ensure_collection(session: &Session, collection: &str, action: Action) -> ApiResult<()> {
    validation::collection_key(collection)?;
    session.user.ensure(collection, action)
}
