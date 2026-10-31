//! Running one claimed job: the attempt row commits before the provider call, the call is
//! bounded by [`CALL_TIMEOUT`], and the result settles the job (design §5, SEC-2).
use super::model::{Domain, Job, Outcome, CALL_TIMEOUT, MAX_ATTEMPTS};
use crate::{error::ApiResult, signup::retry::backoff};
use sqlx::PgPool;
use uuid::Uuid;

/// Sends one job through its domain. Returns `false` when the lease was already lost, in
/// which case nothing was sent.
/// The attempt insert locks the job row, so the lease check is re-evaluated after any
/// concurrent sweep commits (X2-S3): a sweep either sees this attempt or wins first.
pub async fn run(pool: &PgPool, domain: &dyn Domain, job: &Job, jitter_ms: u64) -> ApiResult<bool> {
    let attempt = Uuid::new_v4();
    let started = sqlx::query(
        "INSERT INTO outbox.crm_outbox_attempts (id,job_id,attempt) \
         SELECT $1,id,attempts FROM outbox.crm_outbox_jobs \
         WHERE id=$2 AND state='leased' AND lease_owner=$3 AND lease_expires_at>now() \
         FOR UPDATE",
    )
    .bind(attempt)
    .bind(job.id)
    .bind(job.owner)
    .execute(pool)
    .await?
    .rows_affected();
    if started == 0 {
        return Ok(false);
    }
    let outcome = tokio::time::timeout(CALL_TIMEOUT, domain.send(job))
        .await
        .unwrap_or(Outcome::Unknown { code: "timeout" });
    finish(pool, job, attempt, &outcome, jitter_ms).await?;
    Ok(true)
}

/// Records the attempt and moves the job on. `Sent` also resolves a job that a lease sweep
/// marked `unknown` meanwhile, because the provider's acceptance is now known. Every other
/// result applies only while this worker still holds the lease.
pub async fn finish(
    pool: &PgPool,
    job: &Job,
    attempt: Uuid,
    outcome: &Outcome,
    jitter_ms: u64,
) -> ApiResult<()> {
    let mut transaction = pool.begin().await?;
    sqlx::query(
        "UPDATE outbox.crm_outbox_attempts SET finished_at=now(),outcome=$2 \
         WHERE id=$1 AND (finished_at IS NULL OR ($2='sent' AND outcome='unknown'))",
    )
    .bind(attempt)
    .bind(outcome.label())
    .execute(&mut *transaction)
    .await?;
    let (state, code, delay) = match outcome {
        Outcome::Sent => ("done", None, None),
        Outcome::Retry { after, code } if job.attempts < MAX_ATTEMPTS => (
            "pending",
            Some(*code),
            Some(backoff(job.attempts, *after, jitter_ms)),
        ),
        Outcome::Retry { code, .. } | Outcome::Failed { code } => ("failed", Some(*code), None),
        Outcome::Unknown { code } => ("unknown", Some(*code), None),
    };
    sqlx::query(
        "UPDATE outbox.crm_outbox_jobs SET state=$3,last_failure_code=$4,lease_owner=NULL, \
           lease_expires_at=NULL,updated_at=now(), \
           available_at=CASE WHEN $3='pending' \
             THEN now()+make_interval(secs=>$5) ELSE available_at END, \
           finished_at=CASE WHEN $3='pending' THEN NULL ELSE now() END \
         WHERE id=$1 AND ((state='leased' AND lease_owner=$2) OR ($3='done' AND state='unknown'))",
    )
    .bind(job.id)
    .bind(job.owner)
    .bind(state)
    .bind(code)
    .bind(delay.map_or(0.0, |value| value.as_secs_f64()))
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(())
}
