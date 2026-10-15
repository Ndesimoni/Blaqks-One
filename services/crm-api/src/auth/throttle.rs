use super::session::digest;
use crate::error::{ApiError, ApiResult};
use axum::http::StatusCode;
use sqlx::PgPool;
use uuid::Uuid;

const SIGN_IN: &str = "Too many sign-in attempts. Try again later.";
const PASSWORD: &str = "Too many password attempts. Try again later.";

/// Counts one attempt against `key` in a 15-minute window; the attempt past `limit`
/// returns 429 `rate_limited` with `message`.
async fn consume(pool: &PgPool, key: &str, limit: i32, message: &'static str) -> ApiResult<()> {
    let attempts: i32 = sqlx::query_scalar(
        "INSERT INTO crm_login_limits (key_hash, attempts) VALUES ($1,1) \
         ON CONFLICT (key_hash) DO UPDATE SET \
         attempts=CASE WHEN crm_login_limits.window_started<now()-interval '15 minutes' \
         THEN 1 ELSE crm_login_limits.attempts+1 END, \
         window_started=CASE WHEN crm_login_limits.window_started<now()-interval '15 minutes' \
         THEN now() ELSE crm_login_limits.window_started END RETURNING attempts",
    )
    .bind(digest(key))
    .fetch_one(pool)
    .await?;
    if attempts > limit {
        return Err(ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            message,
            "rate_limited",
        ));
    }
    Ok(())
}

pub async fn check(pool: &PgPool, email: &str) -> ApiResult<()> {
    sqlx::query("DELETE FROM crm_login_limits WHERE window_started<now()-interval '15 minutes'")
        .execute(pool)
        .await?;
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
