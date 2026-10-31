use super::retry::MAX_ATTEMPTS;
use crate::error::ApiResult;
use sqlx::PgPool;
use std::time::Duration;

/// Bounded, lock-skipping retention work, safe beside start, resend, verify and a worker
/// that holds a job row during a provider call: every statement skips locked rows and
/// touches at most 1000 of them, so a public request never waits on a delivery.
pub async fn run(pool: &PgPool) -> ApiResult<()> {
    sqlx::query(
        "UPDATE crm_signup_outbox o SET code=NULL,terminal_at=COALESCE(o.terminal_at,now()), \
         last_error=COALESCE(o.last_error,'expired'),lease_owner=NULL,lease_expires_at=NULL \
         WHERE o.id IN (SELECT j.id FROM crm_signup_outbox j \
         JOIN crm_signup_requests r ON r.id=j.request_id WHERE j.kind='code' \
         AND j.code IS NOT NULL AND r.code_expires_at<=now() \
         LIMIT 1000 FOR UPDATE OF j SKIP LOCKED)",
    )
    .execute(pool)
    .await?;
    // A job claimed MAX_ATTEMPTS times can only be unfinished after crashes; claim skips
    // it, so end it here rather than leave it pending.
    sqlx::query(
        "UPDATE crm_signup_outbox SET terminal_at=now(),code=NULL,lease_owner=NULL, \
         lease_expires_at=NULL,last_error='attempts exhausted' WHERE id IN (SELECT id \
         FROM crm_signup_outbox WHERE delivered_at IS NULL AND terminal_at IS NULL \
         AND attempts>=$1 AND (lease_expires_at IS NULL OR lease_expires_at<=now()) \
         LIMIT 1000 FOR UPDATE SKIP LOCKED)",
    )
    .bind(MAX_ATTEMPTS)
    .execute(pool)
    .await?;
    sqlx::query(
        "DELETE FROM crm_signup_outbox WHERE id IN (SELECT id FROM crm_signup_outbox \
         WHERE terminal_at<=now()-interval '24 hours' LIMIT 1000 FOR UPDATE SKIP LOCKED)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "DELETE FROM crm_signup_requests WHERE id IN (SELECT id FROM crm_signup_requests \
         WHERE expires_at<=now() OR created_at<=now()-interval '24 hours' \
         ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED)",
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub fn schedule(pool: PgPool) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        interval.tick().await;
        loop {
            interval.tick().await;
            if run(&pool).await.is_err() {
                eprintln!("CRM sign-up retention cleanup failed.");
            }
        }
    });
}
