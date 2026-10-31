use super::claim::Claimed;
use crate::{
    error::ApiResult,
    signup::{
        delivery::{Delivery, DeliveryError, Message},
        retry::{self, MAX_ATTEMPTS},
    },
};
use sqlx::{FromRow, PgConnection, PgPool};
use uuid::Uuid;

#[derive(FromRow)]
struct Current {
    code: Option<String>,
    superseded: bool,
    delivered: bool,
    terminal: bool,
    owner: Option<Uuid>,
}

async fn terminal(connection: &mut PgConnection, id: Uuid, message: &str) -> ApiResult<()> {
    sqlx::query(
        "UPDATE crm_signup_outbox SET terminal_at=now(),code=NULL,lease_owner=NULL, \
         lease_expires_at=NULL,last_error=$2 WHERE id=$1",
    )
    .bind(id)
    .bind(message)
    .execute(&mut *connection)
    .await?;
    Ok(())
}

async fn finish(pool: &PgPool, id: Uuid, message: &str) -> ApiResult<()> {
    let mut connection = pool.acquire().await?;
    terminal(&mut connection, id, message).await
}

/// Delivers one claimed job. The request advisory lock serialises this with resend, and the
/// job is re-read under `FOR UPDATE` after the lock, so a superseded code is never sent.
/// Success clears the plaintext code; retryable failures clear the lease and schedule the
/// next attempt; permanent failures or exhausted attempts become terminal.
pub async fn run(
    pool: &PgPool,
    delivery: &dyn Delivery,
    job: Claimed,
    jitter_ms: u64,
) -> ApiResult<()> {
    if job.expired || job.code_expired {
        finish(pool, job.id, "expired").await?;
        return Ok(());
    }
    let mut transaction = pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(job.request_id.to_string())
        .execute(&mut *transaction)
        .await?;
    let current: Option<Current> = sqlx::query_as(
        r#"SELECT code,superseded_at IS NOT NULL AS superseded,
           delivered_at IS NOT NULL AS delivered,terminal_at IS NOT NULL AS terminal,
           lease_owner AS owner
           FROM crm_signup_outbox WHERE id=$1 FOR UPDATE"#,
    )
    .bind(job.id)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(current) = current else {
        transaction.rollback().await?;
        return Ok(());
    };
    if current.superseded
        || current.delivered
        || current.terminal
        || current.owner != Some(job.owner)
    {
        transaction.rollback().await?;
        return Ok(());
    }
    let message = Message {
        id: job.id,
        code: current.code,
        masked_email: super::super::code::mask(&job.email),
        expires_at: job.expires_at.clone(),
    };
    match delivery.deliver(message).await {
        Ok(()) => {
            sqlx::query(
                "UPDATE crm_signup_outbox SET delivered_at=now(),code=NULL,lease_owner=NULL, \
                 lease_expires_at=NULL,last_error=NULL WHERE id=$1",
            )
            .bind(job.id)
            .execute(&mut *transaction)
            .await?;
        }
        Err(DeliveryError::Permanent { message }) => {
            terminal(&mut transaction, job.id, message).await?;
        }
        Err(DeliveryError::Retry { after, message }) => {
            if job.attempts >= MAX_ATTEMPTS {
                terminal(&mut transaction, job.id, message).await?;
            } else {
                let delay = retry::backoff(job.attempts, after, jitter_ms);
                sqlx::query(
                    "UPDATE crm_signup_outbox SET \
                     next_attempt_at=now()+make_interval(secs=>$2),lease_owner=NULL, \
                     lease_expires_at=NULL,last_error=$3 WHERE id=$1",
                )
                .bind(job.id)
                .bind(delay.as_secs_f64())
                .bind(message)
                .execute(&mut *transaction)
                .await?;
            }
        }
    }
    transaction.commit().await?;
    Ok(())
}
