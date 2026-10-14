use super::{
    eligibility::{apply, eligible, ensure_holder, visible_entry},
    handoff,
    requests::{self, AssignRequest},
};
use crate::{
    auth::{grants::Action, protection, session::Session},
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
    handoff::ensure_assign_grant(&session.user, &collection, true)?;
    let Json(body) = body.map_err(|_| ApiError::invalid("Provide a version and an assignee."))?;
    requests::ensure_version(body.version)?;
    let to = requests::target(body.assignee_id)?;
    handoff::ensure_assign_grant(&session.user, &collection, to.is_none())?;
    let note = requests::note(body.note)?;
    let id = Uuid::parse_str(&id).map_err(|_| ApiError::invalid("Invalid server record ID."))?;
    handoff::ensure_queue(RecordScope::of(&session.user), &collection, to)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let actor = session.user.id;
    let user =
        workspaces::ensure_writable(&mut tx, &workspace, actor, Some(&collection), None).await?;
    handoff::ensure_assign_grant(&user, &collection, to.is_none())?;
    let scope = RecordScope::of(&user);
    handoff::ensure_queue(scope, &collection, to)?;
    let found = target::fetch(&mut tx, &workspace, &collection, id, scope).await?;
    target::ensure_version(
        &found,
        body.version,
        "This record changed. Reload before saving.",
    )?;
    if !user.can(&collection, Action::Assign) {
        handoff::ensure_return(scope, &found, to)?;
    }
    ensure_holder(scope, &collection, &found)?;
    handoff::ensure_target(scope, &collection, &found, to)?;
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
