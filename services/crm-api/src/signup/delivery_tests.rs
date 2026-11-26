use super::{
    jobs::{claim, run},
    retry::MAX_ATTEMPTS,
    test_support::{fixture, reset, Counting, Permanent, RetryOnce},
};
use crate::test_database;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use uuid::Uuid;

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn success_clears_the_code_and_marks_the_job_delivered() {
    let pool = test_database::pool().await;
    reset(&pool).await;
    let job = fixture(&pool).await;
    let claimed = claim(&pool, Uuid::new_v4(), 30).await.unwrap().unwrap();
    let calls = Arc::new(AtomicUsize::new(0));
    run(&pool, &Counting(calls.clone()), claimed, 0)
        .await
        .unwrap();
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    let row: (Option<String>, bool, Option<Uuid>) = sqlx::query_as(
        "SELECT code,delivered_at IS NOT NULL,lease_owner FROM crm_signup_outbox WHERE id=$1",
    )
    .bind(job)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(row, (None, true, None));
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn retryable_failure_schedules_again_then_terminates_at_the_cap() {
    let pool = test_database::pool().await;
    reset(&pool).await;
    let job = fixture(&pool).await;
    let claimed = claim(&pool, Uuid::new_v4(), 30).await.unwrap().unwrap();
    run(&pool, &RetryOnce, claimed, 0).await.unwrap();
    let row: (Option<String>, String, bool) = sqlx::query_as(
        "SELECT code,last_error,next_attempt_at>now() FROM crm_signup_outbox WHERE id=$1",
    )
    .bind(job)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(row, (Some("012345".into()), "transport retry".into(), true));
    sqlx::query(
        "UPDATE crm_signup_outbox SET attempts=$2,next_attempt_at=now(), \
         lease_owner=NULL,lease_expires_at=NULL WHERE id=$1",
    )
    .bind(job)
    .bind(MAX_ATTEMPTS - 1)
    .execute(&pool)
    .await
    .unwrap();
    // The final allowed claim reaches MAX_ATTEMPTS; a retryable failure then ends the job.
    let claimed = claim(&pool, Uuid::new_v4(), 30).await.unwrap().unwrap();
    assert_eq!(claimed.attempts, MAX_ATTEMPTS);
    run(&pool, &RetryOnce, claimed, 0).await.unwrap();
    let terminal: (Option<String>, bool) =
        sqlx::query_as("SELECT code,terminal_at IS NOT NULL FROM crm_signup_outbox WHERE id=$1")
            .bind(job)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(terminal, (None, true));
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn a_permanent_failure_becomes_terminal_without_a_code() {
    let pool = test_database::pool().await;
    reset(&pool).await;
    let job = fixture(&pool).await;
    let claimed = claim(&pool, Uuid::new_v4(), 30).await.unwrap().unwrap();
    run(&pool, &Permanent, claimed, 0).await.unwrap();
    let row: (Option<String>, bool, String) = sqlx::query_as(
        "SELECT code,terminal_at IS NOT NULL,last_error FROM crm_signup_outbox WHERE id=$1",
    )
    .bind(job)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(row, (None, true, "permanent delivery failure".into()));
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn a_superseded_or_expired_job_is_never_delivered() {
    let pool = test_database::pool().await;
    reset(&pool).await;
    let superseded = fixture(&pool).await;
    let claimed = claim(&pool, Uuid::new_v4(), 30).await.unwrap().unwrap();
    sqlx::query(
        "UPDATE crm_signup_outbox SET superseded_at=now(),terminal_at=now(),code=NULL \
         WHERE id=$1",
    )
    .bind(superseded)
    .execute(&pool)
    .await
    .unwrap();
    let calls = Arc::new(AtomicUsize::new(0));
    run(&pool, &Counting(calls.clone()), claimed, 0)
        .await
        .unwrap();
    assert_eq!(calls.load(Ordering::SeqCst), 0);

    let expired = fixture(&pool).await;
    sqlx::query(
        "UPDATE crm_signup_requests SET created_at=now()-interval '2 minutes', \
         code_expires_at=now()-interval '1 minute', \
         expires_at=now()-interval '1 second' WHERE id= \
         (SELECT request_id FROM crm_signup_outbox WHERE id=$1)",
    )
    .bind(expired)
    .execute(&pool)
    .await
    .unwrap();
    let claimed = claim(&pool, Uuid::new_v4(), 30).await.unwrap().unwrap();
    run(&pool, &Counting(calls.clone()), claimed, 0)
        .await
        .unwrap();
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    let row: (Option<String>, bool) =
        sqlx::query_as("SELECT code,terminal_at IS NOT NULL FROM crm_signup_outbox WHERE id=$1")
            .bind(expired)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(row, (None, true));
}
