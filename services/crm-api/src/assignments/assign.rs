use super::{
    eligibility::{apply, eligible, ensure_holder, visible_entry},
    requests::{self, AssignRequest},
};
use crate::{
    auth::{protection, session::Session},
    error::{ApiError, ApiResult},
    records::{history::Change, target, validation::collection_key, visibility::RecordScope},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

const QUEUE_DENIED: &str = "Only your Admin can move records to the queue.";

/// `PUT /workspaces/{ws}/records/{collection}/{id}/assignee` in the §4 order.
pub async fn assign(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, collection, id)): Path<(String, String, String)>,
    body: Result<Json<AssignRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    workspaces::ensure_access(&state, &session, &workspace).await?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    collection_key(&collection)?;
    if !session.user.can_collection(&collection) {
        return Err(ApiError::forbidden());
    }
    requests::ensure_assignable(&collection)?;
    let Json(body) = body.map_err(|_| ApiError::invalid("Provide a version and an assignee."))?;
    requests::ensure_version(body.version)?;
    let to = requests::target(body.assignee_id)?;
    let note = requests::note(body.note)?;
    let id = Uuid::parse_str(&id).map_err(|_| ApiError::invalid("Invalid server record ID."))?;
    if to.is_none() && !RecordScope::of(&session.user).is_team() {
        return Err(ApiError::denied(QUEUE_DENIED));
    }
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let actor = session.user.id;
    let user = workspaces::ensure_writable(&mut tx, &workspace, actor, Some(&collection)).await?;
    let scope = RecordScope::of(&user);
    if to.is_none() && !scope.is_team() {
        return Err(ApiError::denied(QUEUE_DENIED));
    }
    let found = target::fetch(&mut tx, &workspace, &collection, id, scope).await?;
    target::ensure_version(
        &found,
        body.version,
        "This record changed. Reload before saving.",
    )?;
    ensure_holder(scope, &collection, &found)?;
    if let Some(member) = to {
        eligible(&mut tx, &workspace, &collection, member).await?;
    }
    if found.assignee_id != to {
        let change = Change {
            workspace: &workspace,
            record: id,
            collection: &collection,
            from: found.assignee_id,
            to,
            actor,
            reason: "reassigned",
        };
        apply(&mut tx, &change, note.as_deref()).await?;
    }
    let entry = visible_entry(&mut tx, &workspace, id, scope).await?;
    tx.commit().await?;
    Ok(Json(json!({ "entry": entry })))
}
