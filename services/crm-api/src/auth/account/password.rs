//! `POST /auth/account/password` (account-self-service.md, endpoint 3). A wrong current
//! password is a 400 that never ends the session; a change rotates the session and CSRF
//! tokens and signs out every other device in one transaction.
use super::{
    events::{self, Action},
    live, profile,
};
use crate::{
    auth::{password, password_policy, protection, session, session::Session, sessions, throttle},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, State},
    http::{header, HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct PasswordRequest {
    current_password: String,
    new_password: String,
}

fn wrong_current() -> ApiError {
    ApiError(
        StatusCode::BAD_REQUEST,
        "Current password is incorrect.",
        "invalid_current_password",
    )
}

fn unavailable() -> ApiError {
    ApiError::invalid("Authentication is temporarily unavailable.")
}

pub async fn change(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    body: Result<Json<PasswordRequest>, JsonRejection>,
) -> ApiResult<(HeaderMap, Json<Value>)> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) =
        body.map_err(|_| ApiError::invalid("Provide your current and new password."))?;
    if request.current_password.is_empty() || request.current_password.len() > 1024 {
        return Err(ApiError::invalid("Provide your current and new password."));
    }
    let user = session.user.id;
    password_policy::check(
        &request.new_password,
        Some(&request.current_password),
        &session.user.email,
    )?;
    throttle::password(&state.pool, user).await?;
    // Argon2 always runs against the caller's own stored hash, under the worker limit.
    let stored: String = sqlx::query_scalar("SELECT password_hash FROM crm_users WHERE id=$1")
        .bind(user)
        .fetch_one(&state.pool)
        .await?;
    let permit = state
        .password_workers
        .acquire()
        .await
        .map_err(|_| unavailable())?;
    if !password::verify(request.current_password, stored.clone()).await? {
        return Err(wrong_current());
    }
    let hash = password::hash(request.new_password).await?;
    drop(permit);
    let workspace = session.user.workspace_id.as_str();
    let mut transaction = state.pool.begin().await?;
    workspaces::lock(&mut transaction, workspace).await?;
    if live::lock(&mut transaction, user).await?.password_hash != stored {
        return Err(profile::stale());
    }
    // The version stays unchanged, so an Admin's open edit of this member stays valid.
    sqlx::query("UPDATE crm_users SET password_hash=$2,password_changed_at=now() WHERE id=$1")
        .bind(user)
        .bind(hash)
        .execute(&mut *transaction)
        .await?;
    // Every session ends, the current one included; one that was already revoked
    // elsewhere cannot be renewed here.
    let revoked: Vec<String> =
        sqlx::query_scalar("DELETE FROM crm_sessions WHERE user_id=$1 RETURNING token_hash")
            .bind(user)
            .fetch_all(&mut *transaction)
            .await?;
    if !revoked.contains(&session.token_hash) {
        return Err(ApiError::unauthorized());
    }
    let issued = sessions::issue(&mut transaction, user, session.device.as_deref()).await?;
    events::append(
        &mut transaction,
        user,
        user,
        workspace,
        Action::PasswordChanged,
    )
    .await?;
    transaction.commit().await?;
    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::SET_COOKIE,
        session::cookie(&issued.token, state.config.secure_cookie, false)
            .parse()
            .map_err(|_| unavailable())?,
    );
    let body = json!({"csrfToken": issued.csrf_token, "signedOutOthers": revoked.len() - 1});
    Ok((response_headers, Json(body)))
}
