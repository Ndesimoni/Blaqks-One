//! Claiming jobs and settling expired leases (design §5, SEC-2).
use super::model::{Job, MAX_ATTEMPTS};
use crate::error::ApiResult;
use sqlx::PgPool;
use uuid::Uuid;

/// Settles every expired lease. A job whose attempt never finished may already be at the
/// provider, so it becomes `unknown` and is never claimed again. A job with no open attempt
/// was never sent: it returns to `pending`, or `failed` once its claims are used up.
pub async fn settle_expired(pool: &PgPool) -> ApiResult<u64> {
    let mut transaction = pool.begin().await?;
    let settled = sqlx::query(
        "WITH expired AS ( \
            SELECT j.id,j.attempts,EXISTS ( \
              SELECT 1 FROM outbox.crm_outbox_attempts a \
              WHERE a.job_id=j.id AND a.finished_at IS NULL) AS in_flight \
            FROM outbox.crm_outbox_jobs j \
            WHERE j.state='leased' AND j.lease_expires_at<=now() \
            FOR UPDATE OF j SKIP LOCKED), \
         next AS ( \
            SELECT id,CASE WHEN in_flight THEN 'unknown' \
              WHEN attempts>=$1 THEN 'failed' ELSE 'pending' END AS state \
            FROM expired) \
         UPDATE outbox.crm_outbox_jobs j SET state=n.state,lease_owner=NULL, \
           lease_expires_at=NULL,updated_at=now(), \
           finished_at=CASE WHEN n.state='pending' THEN NULL ELSE now() END, \
           last_failure_code=CASE WHEN n.state='pending' THEN j.last_failure_code \
             ELSE 'lease_expired' END \
         FROM next n WHERE j.id=n.id",
    )
    .bind(MAX_ATTEMPTS)
    .execute(&mut *transaction)
    .await?
    .rows_affected();
    sqlx::query(
        "UPDATE outbox.crm_outbox_attempts a SET finished_at=now(),outcome='unknown' \
         FROM outbox.crm_outbox_jobs j \
         WHERE a.job_id=j.id AND a.finished_at IS NULL AND j.state='unknown'",
    )
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(settled)
}

/// Claims one due job of the given domains with `FOR UPDATE SKIP LOCKED`, so two workers
/// never own the same job. A worker claims only domains it can send.
pub async fn claim(
    pool: &PgPool,
    owner: Uuid,
    domains: &[&str],
    lease_secs: i64,
) -> ApiResult<Option<Job>> {
    let domains: Vec<String> = domains.iter().map(|name| (*name).to_owned()).collect();
    sqlx::query_as(
        "WITH candidate AS ( \
            SELECT id FROM outbox.crm_outbox_jobs \
            WHERE state='pending' AND available_at<=now() AND domain=ANY($3) \
            ORDER BY available_at,created_at LIMIT 1 FOR UPDATE SKIP LOCKED) \
         UPDATE outbox.crm_outbox_jobs j SET state='leased',lease_owner=$1, \
           lease_expires_at=now()+make_interval(secs=>$2),attempts=j.attempts+1, \
           updated_at=now() \
         FROM candidate c WHERE j.id=c.id \
         RETURNING j.id,j.workspace_id,j.domain,j.object_id,j.attempts,j.lease_owner AS owner",
    )
    .bind(owner)
    .bind(lease_secs as f64)
    .bind(&domains)
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}
