//! Lease expiry and crash recovery on the disposable test database (SEC-2).
use super::{
    claim::{claim, settle_expired},
    db_tests::{fresh, queued, state},
    model::Outcome,
    run::{finish, run},
    tests::Scripted,
};
use sqlx::PgPool;
use uuid::Uuid;

const DOMAINS: &[&str] = &["inbox"];

async fn expire(pool: &PgPool, job: Uuid) {
    sqlx::query(
        "UPDATE outbox.crm_outbox_jobs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",
    )
    .bind(job)
    .execute(pool)
    .await
    .unwrap();
}

/// What a worker that crashed mid-call leaves behind: a committed, unfinished attempt.
async fn crashed_mid_call(pool: &PgPool, job: Uuid) -> Uuid {
    let attempt = Uuid::new_v4();
    sqlx::query("INSERT INTO outbox.crm_outbox_attempts (id,job_id,attempt) VALUES ($1,$2,1)")
        .bind(attempt)
        .bind(job)
        .execute(pool)
        .await
        .unwrap();
    attempt
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn a_crash_during_the_call_leaves_unknown_and_no_second_send() {
    let pool = fresh().await;
    let (job, _) = queued(&pool).await;
    claim(&pool, Uuid::new_v4(), DOMAINS, 60)
        .await
        .unwrap()
        .unwrap();
    crashed_mid_call(&pool, job).await;
    expire(&pool, job).await;
    assert_eq!(settle_expired(&pool).await.unwrap(), 1);
    let code = Some("lease_expired".to_owned());
    assert_eq!(state(&pool, job).await, ("unknown".into(), code, 1));
    assert!(claim(&pool, Uuid::new_v4(), DOMAINS, 60)
        .await
        .unwrap()
        .is_none());
    let open: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM outbox.crm_outbox_attempts WHERE job_id=$1 AND outcome='unknown'",
    )
    .bind(job)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(open, 1);
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn a_crash_before_the_call_is_safely_retried_after_a_restart() {
    let pool = fresh().await;
    let (job, _) = queued(&pool).await;
    claim(&pool, Uuid::new_v4(), DOMAINS, 60)
        .await
        .unwrap()
        .unwrap();
    expire(&pool, job).await;
    settle_expired(&pool).await.unwrap();
    assert_eq!(state(&pool, job).await.0, "pending");
    let domain = Scripted::new(vec![Outcome::Sent]);
    let again = claim(&pool, Uuid::new_v4(), DOMAINS, 60)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(again.attempts, 2);
    assert!(run(&pool, &domain, &again, 0).await.unwrap());
    assert_eq!(state(&pool, job).await.0, "done");
    assert_eq!(domain.calls(), 1);
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn a_lost_lease_never_calls_the_provider() {
    let pool = fresh().await;
    let (job, _) = queued(&pool).await;
    let claimed = claim(&pool, Uuid::new_v4(), DOMAINS, 60)
        .await
        .unwrap()
        .unwrap();
    expire(&pool, job).await;
    let domain = Scripted::new(vec![Outcome::Sent]);
    assert!(!run(&pool, &domain, &claimed, 0).await.unwrap());
    assert_eq!(domain.calls(), 0);
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn provider_acceptance_resolves_a_job_swept_to_unknown() {
    let pool = fresh().await;
    let (job, _) = queued(&pool).await;
    let claimed = claim(&pool, Uuid::new_v4(), DOMAINS, 60)
        .await
        .unwrap()
        .unwrap();
    let attempt = crashed_mid_call(&pool, job).await;
    expire(&pool, job).await;
    settle_expired(&pool).await.unwrap();
    finish(&pool, &claimed, attempt, &Outcome::Sent, 0)
        .await
        .unwrap();
    assert_eq!(state(&pool, job).await, ("done".into(), None, 1));
    let failed = Outcome::Failed { code: "refused" };
    let (other, _) = queued(&pool).await;
    let late = claim(&pool, Uuid::new_v4(), DOMAINS, 60)
        .await
        .unwrap()
        .unwrap();
    let attempt = crashed_mid_call(&pool, other).await;
    expire(&pool, other).await;
    settle_expired(&pool).await.unwrap();
    finish(&pool, &late, attempt, &failed, 0).await.unwrap();
    assert_eq!(state(&pool, other).await.0, "unknown");
}
