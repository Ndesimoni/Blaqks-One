//! `GET /auth/account` and `PATCH /auth/account` (account-self-service.md, endpoints 1
//! and 2). Members edit only their own name and phone; every other identity, access and
//! workspace field is never self-editable, and unknown fields are refused.
use super::{
    events::{self, Action},
    live,
};
use crate::{
    auth::{identity_rules, protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::Value;

#[path = "response.rs"]
mod response;
pub(super) use response::load;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateRequest {
    version: i64,
    name: Option<String>,
    phone: Option<String>,
}

/// The 409 for a concurrent change to the caller's own account.
pub fn stale() -> ApiError {
    ApiError(
        StatusCode::CONFLICT,
        "Your account changed elsewhere. Reload and try again.",
        "stale",
    )
}

pub async fn account(State(state): State<AppState>, session: Session) -> ApiResult<Json<Value>> {
    let mut transaction = state.pool.begin().await?;
    let account = load(&mut transaction, session.user.id).await?;
    transaction.commit().await?;
    Ok(Json(account))
}

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    body: Result<Json<UpdateRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) =
        body.map_err(|_| ApiError::invalid("Provide your account version and details."))?;
    let name = request.name.as_deref().map(str::trim);
    let phone = request.phone.as_deref().map(str::trim);
    if request.version < 1 || (name.is_none() && phone.is_none()) {
        return Err(ApiError::invalid(
            "Provide your account version and details.",
        ));
    }
    if name.is_some_and(|value| !identity_rules::name(value)) {
        return Err(ApiError::invalid("Use a name of 1 to 100 characters."));
    }
    if phone.is_some_and(|value| !identity_rules::phone(value)) {
        return Err(ApiError::invalid(
            "Provide a phone number including country code.",
        ));
    }
    let user = session.user.id;
    let workspace = session.user.workspace_id.as_str();
    let mut transaction = state.pool.begin().await?;
    workspaces::lock(&mut transaction, workspace).await?;
    if live::lock(&mut transaction, user).await?.version != request.version {
        return Err(stale());
    }
    sqlx::query(
        "UPDATE crm_users SET name=COALESCE($2,name),phone=COALESCE($3,phone), \
         version=version+1 WHERE id=$1",
    )
    .bind(user)
    .bind(name)
    .bind(phone)
    .execute(&mut *transaction)
    .await?;
    events::append(
        &mut transaction,
        user,
        user,
        workspace,
        Action::ProfileUpdated,
    )
    .await?;
    let account = load(&mut transaction, user).await?;
    transaction.commit().await?;
    Ok(Json(account))
}
