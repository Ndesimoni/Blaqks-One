use super::session::digest;
use crate::error::{ApiError, ApiResult};
use axum::http::StatusCode;
use sqlx::PgPool;
use uuid::Uuid;

const SIGN_IN: &str = "Too many sign-in attempts. Try again later.";
const PASSWORD: &str = "Too many password attempts. Try again later.";

/// Counts an attempt in this key's window. A live row keeps its existing window;
/// an expired row restarts with the requested duration. Keys must name their budget.
pub(crate) async fn consume_window<'e>(
    executor: impl sqlx::PgExecutor<'e>,
    key: &str,
    limit: i32,
    window_seconds: i32,
    message: &'static str,
    code: &'static str,
) -> ApiResult<()> {
    if key.is_empty() || limit < 1 || window_seconds < 1 {
        return Err(ApiError::invalid("Invalid rate limit configuration."));
    }
    let attempts: i32 = sqlx::query_scalar(
        "INSERT INTO crm_login_limits (key_hash,attempts,window_seconds) VALUES ($1,1,$2) \
         ON CONFLICT (key_hash) DO UPDATE SET \
         attempts=CASE WHEN crm_login_limits.window_started< \
         now()-crm_login_limits.window_seconds*interval '1 second' \
         THEN 1 ELSE crm_login_limits.attempts+1 END, \
         window_started=CASE WHEN crm_login_limits.window_started< \
         now()-crm_login_limits.window_seconds*interval '1 second' \
         THEN now() ELSE crm_login_limits.window_started END, \
         window_seconds=CASE WHEN crm_login_limits.window_started< \
         now()-crm_login_limits.window_seconds*interval '1 second' \
         THEN EXCLUDED.window_seconds ELSE crm_login_limits.window_seconds END RETURNING attempts",
    )
    .bind(digest(key))
    .bind(window_seconds)
    .fetch_one(executor)
    .await?;
    if attempts > limit {
        return Err(ApiError(StatusCode::TOO_MANY_REQUESTS, message, code));
    }
    Ok(())
}

/// Bounded expiry cleanup shared by sign-in and public sign-up budgets.
pub(crate) async fn cleanup(pool: &PgPool) -> ApiResult<()> {
    sqlx::query(
        "DELETE FROM crm_login_limits WHERE key_hash IN (SELECT key_hash \
         FROM crm_login_limits WHERE window_started< \
         now()-window_seconds*interval '1 second' ORDER BY window_started \
         LIMIT 1000 FOR UPDATE SKIP LOCKED)",
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Existing sign-in, invitation and password checks keep their 15-minute budgets.
async fn consume(pool: &PgPool, key: &str, limit: i32, message: &'static str) -> ApiResult<()> {
    consume_window(pool, key, limit, 900, message, "rate_limited").await
}

pub async fn check(pool: &PgPool, email: &str) -> ApiResult<()> {
    cleanup(pool).await?;
    consume(pool, "global-login-budget", 100, SIGN_IN).await?;
    consume(pool, &format!("email:{email}"), 10, SIGN_IN).await
}

pub async fn invitation(pool: &PgPool, token: &str) -> ApiResult<()> {
    consume(pool, "global-invitation-budget", 200, SIGN_IN).await?;
    consume(pool, &format!("invitation:{}", digest(token)), 20, SIGN_IN).await
}

/// Current-password checks by a signed-in member: 5 per 15 minutes per account, separate
/// from the sign-in budget (account-self-service.md, endpoint 3).
pub async fn password(pool: &PgPool, user: Uuid) -> ApiResult<()> {
    consume(pool, &format!("password:{user}"), 5, PASSWORD).await
}

#[cfg(test)]
#[path = "throttle_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "throttle_legacy_tests.rs"]
mod legacy_tests;
