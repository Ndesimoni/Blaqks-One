use crate::error::ApiResult;
use sqlx::PgPool;
use std::time::Duration;

/// Bounded, lock-skipping retention work is safe beside start, resend, verify and delivery.
pub async fn run(pool: &PgPool) -> ApiResult<()> {
    sqlx::query(
        "UPDATE crm_signup_outbox o SET code=NULL,terminal_at=COALESCE(o.terminal_at,now()), \
         last_error=COALESCE(o.last_error,'expired'),lease_owner=NULL,lease_expires_at=NULL \
         FROM crm_signup_requests r WHERE r.id=o.request_id AND o.kind='code' \
         AND o.code IS NOT NULL AND r.code_expires_at<=now()",
    )
    .execute(pool)
    .await?;
    sqlx::query("DELETE FROM crm_signup_outbox WHERE terminal_at<=now()-interval '24 hours'")
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
