use crate::{auth::throttle, error::ApiResult};
use axum::http::StatusCode;
use sqlx::{PgPool, Postgres, Transaction};

const BUSY: &str = "Too many sign-up attempts. Try again later.";

fn budget_email(email: &str) -> String {
    let (local, host) = email.split_once('@').unwrap_or((email, ""));
    let local = local.split('+').next().unwrap_or(local);
    let local = if matches!(host, "gmail.com" | "googlemail.com") {
        local.replace('.', "")
    } else {
        local.to_owned()
    };
    format!("{local}@{host}")
}

pub async fn start(pool: &PgPool, email: &str) -> ApiResult<()> {
    throttle::cleanup(pool).await?;
    throttle::consume_window(pool, "signup:start:global", 30, 900, BUSY, "rate_limited").await?;
    send(pool, email).await
}

pub async fn resend(pool: &PgPool, email: &str) -> ApiResult<()> {
    send(pool, email).await
}

async fn send(pool: &PgPool, email: &str) -> ApiResult<()> {
    let email = budget_email(email);
    throttle::consume_window(pool, "signup:send:hour", 300, 3_600, BUSY, "rate_limited").await?;
    throttle::consume_window(
        pool,
        &format!("signup:send:hour:{email}"),
        3,
        3600,
        BUSY,
        "rate_limited",
    )
    .await?;
    throttle::consume_window(
        pool,
        &format!("signup:send:day:{email}"),
        10,
        86_400,
        BUSY,
        "rate_limited",
    )
    .await
}

pub async fn notice(pool: &PgPool, email: &str) -> ApiResult<bool> {
    let email = budget_email(email);
    match throttle::consume_window(
        pool,
        &format!("signup:notice:hour:{email}"),
        1,
        3_600,
        BUSY,
        "rate_limited",
    )
    .await
    {
        Ok(()) => Ok(true),
        Err(error) if error.0 == StatusCode::TOO_MANY_REQUESTS => Ok(false),
        Err(error) => Err(error),
    }
}

pub async fn company(transaction: &mut Transaction<'_, Postgres>) -> ApiResult<()> {
    throttle::consume_window(
        &mut **transaction,
        "signup:company:hour",
        30,
        3_600,
        BUSY,
        "rate_limited",
    )
    .await?;
    throttle::consume_window(
        &mut **transaction,
        "signup:company:day",
        200,
        86_400,
        BUSY,
        "rate_limited",
    )
    .await
}
