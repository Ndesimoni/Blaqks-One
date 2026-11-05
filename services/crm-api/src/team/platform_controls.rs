//! Blaqks One suspends or reactivates one person of a company from Companies (BO1a item 8,
//! owner answer Q1), without opening the company. The company's Admin goes through the
//! organisation, like every Admin control; an agent goes through the platform resolver. The
//! member update re-reads the operator and the owner under the workspace lock.
use super::{
    access,
    members::{update::UpdateRequest, update_store},
    platform_members,
};
use crate::{
    auth::{protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

const INVALID: &str = "Provide the member version and whether the account is active.";

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActiveRequest {
    version: i64,
    active: bool,
}

/// `PUT /api/crm/platform/companies/{workspace}/members/{id}/active`.
pub async fn set_active(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<ActiveRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let company_owner = access::company_owner(&state, &session, &workspace).await?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let id = Uuid::parse_str(&id).map_err(|_| ApiError::invalid("Invalid member ID."))?;
    if id == session.user.id {
        return Err(ApiError::forbidden());
    }
    let change = UpdateRequest {
        version: request.version,
        active: Some(request.active),
        name: None,
        phone: None,
        positions: None,
        permissions: None,
        channel_access: None,
        record_scope: None,
        actions: None,
    };
    let organisation = workspaces::ORGANISATION;
    let (owner, scope, admin) = if id == company_owner {
        (
            access::owner(&state, &session, organisation).await?,
            organisation,
            true,
        )
    } else {
        (company_owner, workspace.as_str(), false)
    };
    update_store::update(
        &state.pool,
        session.user.id,
        owner,
        scope,
        id,
        admin,
        change,
    )
    .await?;
    crate::integrations::revoke_soon(&state);
    let mut tx = state.pool.begin().await?;
    let member = platform_members::rows(&mut tx, &workspace, Some(id)).await?;
    tx.commit().await?;
    let member = member.into_iter().next().ok_or_else(ApiError::forbidden)?;
    Ok(Json(json!({ "member": member })))
}
