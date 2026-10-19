//! `PUT /auth/account/language` (docs/i18n.md): each member sets their own interface
//! language from a strict allowlist. There is no member ID in the route, so nobody (Admin
//! or Super Admin included) can change another person's language. A preference has no
//! optimistic version: it never bumps the account version, so an unsaved details draft on
//! My profile is not reset. The change is logged as the existing `profile_updated` event,
//! which names the action only, never the chosen value.
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

/// Supported interface languages; the first is the default.
pub const LANGUAGES: [&str; 2] = ["en", "ar"];

/// The allowlisted code for a stored or requested value. Matching is exact (no trimming
/// or case folding), so only `"en"` and `"ar"` are accepted.
pub fn allowed(value: &str) -> Option<&'static str> {
    LANGUAGES.into_iter().find(|code| *code == value)
}

/// The language a profile exposes: the stored code when allowlisted, otherwise English.
pub fn code(stored: &str) -> &'static str {
    allowed(stored).unwrap_or(LANGUAGES[0])
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LanguageRequest {
    language: String,
}

fn invalid() -> ApiError {
    ApiError::invalid("Choose English or Arabic.")
}

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    body: Result<Json<LanguageRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) = body.map_err(|_| invalid())?;
    let language = allowed(&request.language).ok_or_else(invalid)?;
    let user = session.user.id;
    let workspace = session.user.workspace_id.as_str();
    let mut transaction = state.pool.begin().await?;
    workspaces::lock(&mut transaction, workspace).await?;
    live::lock(&mut transaction, user).await?;
    let changed = sqlx::query("UPDATE crm_users SET language=$2 WHERE id=$1 AND language<>$2")
        .bind(user)
        .bind(language)
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
#[path = "language_tests.rs"]
mod tests;
