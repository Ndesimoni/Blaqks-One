//! `PUT /auth/account/guidance` (docs/deepseek-delivery-plan.md packet Q1): each member
//! turns automatic field hints on or off for their own account. There is no member ID in
//! the route, so nobody can change another person's preference. Like the language
//! preference, a change never bumps the account version, so an unsaved details draft is
//! not reset, and the existing `profile_updated` event names the action only.
use super::{
    events::{self, Action},
    live, profile,
};
use crate::{
    auth::{protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GuidanceRequest {
    enabled: bool,
}

fn invalid() -> ApiError {
    ApiError::invalid("Choose whether field hints are shown.")
}

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    body: Result<Json<GuidanceRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) = body.map_err(|_| invalid())?;
    let enabled = request.enabled;
    let user = session.user.id;
    let workspace = session.user.workspace_id.as_str();
    let mut transaction = state.pool.begin().await?;
    workspaces::lock(&mut transaction, workspace).await?;
    live::lock(&mut transaction, user).await?;
    let changed = sqlx::query(
        "UPDATE crm_users SET guidance_enabled=$2 WHERE id=$1 AND guidance_enabled<>$2",
    )
    .bind(user)
    .bind(enabled)
    .execute(&mut *transaction)
    .await?
    .rows_affected();
    if changed > 0 {
        events::append(
            &mut transaction,
            user,
            user,
            workspace,
            Action::ProfileUpdated,
        )
        .await?;
    }
    let account = profile::load(&mut transaction, user).await?;
    transaction.commit().await?;
    Ok(Json(account))
}

#[cfg(test)]
#[path = "guidance_tests.rs"]
mod tests;
