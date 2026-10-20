//! Database contracts for the outbox on the disposable test database (SEC-2).
use super::{
    claim::{claim, settle_expired},
    enqueue::enqueue,
    model::{Outcome, MAX_ATTEMPTS},
    run::run,
    tests::Scripted,
};
use crate::test_database;
use sqlx::PgPool;
use uuid::Uuid;

const DOMAINS: &[&str] = &["inbox"];

pub async fn fresh() -> PgPool {
    let pool = test_database::pool().await;
    sqlx::query("DELETE FROM outbox.crm_outbox_jobs")
        .execute(&pool)
        .await
        .unwrap();
    pool
}

pub async fn queued(pool: &PgPool) -> (Uuid, Uuid) {
    let object = Uuid::new_v4();
    let mut transaction = pool.begin().await.unwrap();
    let job = enqueue(&mut transaction, "ws-outbox-test", "inbox", object)
        .await
        .unwrap();
    transaction.commit().await.unwrap();
    (job, object)
}

pub async fn state(pool: &PgPool, job: Uuid) -> (String, Option<String>, i32) {
    sqlx::query_as(
        "SELECT state,last_failure_code,attempts FROM outbox.crm_outbox_jobs WHERE id=$1",
    )
    .bind(job)
    .fetch_one(pool)
    .await
    .unwrap()
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn one_object_has_one_live_job_and_one_owner() {
    let pool = fresh().await;
    let (job, object) = queued(&pool).await;
    let mut transaction = pool.begin().await.unwrap();
    let again = enqueue(&mut transaction, "ws-outbox-test", "inbox", object)
        .await
        .unwrap();
    transaction.commit().await.unwrap();
    assert_eq!(again, job);
    let (a, b) = tokio::join!(
        claim(&pool, Uuid::new_v4(), DOMAINS, 60),
        claim(&pool, Uuid::new_v4(), DOMAINS, 60)
    );
    let owners = [a.unwrap(), b.unwrap()];
    assert_eq!(owners.iter().filter(|claimed| claimed.is_some()).count(), 1);
    assert!(claim(&pool, Uuid::new_v4(), &["other"], 60)
        .await
        .unwrap()
        .is_none());
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn a_sent_job_is_done_after_exactly_one_call() {
    let pool = fresh().await;
    let (job, _) = queued(&pool).await;
    let domain = Scripted::new(vec![Outcome::Sent]);
    let claimed = claim(&pool, Uuid::new_v4(), DOMAINS, 60)
        .await
        .unwrap()
        .unwrap();
    assert!(run(&pool, &domain, &claimed, 0).await.unwrap());
    assert_eq!(state(&pool, job).await, ("done".into(), None, 1));
    assert!(claim(&pool, Uuid::new_v4(), DOMAINS, 60)
        .await
        .unwrap()
        .is_none());
    assert_eq!(domain.calls(), 1);
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn retries_back_off_and_stop_at_the_attempt_cap() {
    let pool = fresh().await;
    let (job, _) = queued(&pool).await;
    let retry = Outcome::Retry {
        after: None,
        code: "rate_limited",
    };
    let domain = Scripted::new(vec![retry; MAX_ATTEMPTS as usize]);
    for attempt in 1..=MAX_ATTEMPTS {
        let claimed = claim(&pool, Uuid::new_v4(), DOMAINS, 60)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(claimed.attempts, attempt);
        run(&pool, &domain, &claimed, 0).await.unwrap();
        assert!(claim(&pool, Uuid::new_v4(), DOMAINS, 60)
            .await
            .unwrap()
            .is_none());
        sqlx::query("UPDATE outbox.crm_outbox_jobs SET available_at=now() WHERE id=$1")
            .bind(job)
            .execute(&pool)
            .await
            .unwrap();
    }
    let code = Some("rate_limited".to_owned());
    assert_eq!(
        state(&pool, job).await,
        ("failed".into(), code, MAX_ATTEMPTS)
    );
    assert_eq!(domain.calls(), MAX_ATTEMPTS as usize);
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn an_unclear_provider_reply_is_never_sent_again() {
    let pool = fresh().await;
    let (job, _) = queued(&pool).await;
    let domain = Scripted::new(vec![Outcome::Unknown { code: "timeout" }]);
    let claimed = claim(&pool, Uuid::new_v4(), DOMAINS, 60)
        .await
        .unwrap()
        .unwrap();
    run(&pool, &domain, &claimed, 0).await.unwrap();
    assert_eq!(state(&pool, job).await.0, "unknown");
    settle_expired(&pool).await.unwrap();
    assert!(claim(&pool, Uuid::new_v4(), DOMAINS, 60)
        .await
        .unwrap()
        .is_none());
    assert_eq!(domain.calls(), 1);
}
