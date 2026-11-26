use super::{
    cleanup,
    jobs::claim,
    retry::MAX_ATTEMPTS,
    test_support::{fixture, reset},
};
use crate::test_database;
use uuid::Uuid;

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn a_leased_job_cannot_be_claimed_until_the_lease_expires() {
    let pool = test_database::pool().await;
    reset(&pool).await;
    let job = fixture(&pool).await;
    let first = claim(&pool, Uuid::new_v4(), 30).await.unwrap().unwrap();
    assert_eq!(first.id, job);
    assert_eq!(first.attempts, 1);
    assert!(claim(&pool, Uuid::new_v4(), 30).await.unwrap().is_none());
    sqlx::query(
        "UPDATE crm_signup_outbox SET lease_expires_at=now()-interval '1 second' WHERE id=$1",
    )
    .bind(job)
    .execute(&pool)
    .await
    .unwrap();
    let second = claim(&pool, Uuid::new_v4(), 30).await.unwrap().unwrap();
    assert_eq!(second.id, job);
    assert_eq!(second.attempts, 2);
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn two_workers_claim_different_jobs_concurrently() {
    let pool = test_database::pool().await;
    reset(&pool).await;
    let first = fixture(&pool).await;
    let second = fixture(&pool).await;
    let (a, b) = tokio::join!(
        claim(&pool, Uuid::new_v4(), 30),
        claim(&pool, Uuid::new_v4(), 30)
    );
    let claimed = [a.unwrap(), b.unwrap()];
    assert!(claimed.iter().all(Option::is_some));
    let ids: Vec<Uuid> = claimed.into_iter().flatten().map(|job| job.id).collect();
    assert_ne!(ids[0], ids[1]);
    assert!(ids.contains(&first) && ids.contains(&second));
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn an_expired_request_is_claimed_only_to_be_finished() {
    let pool = test_database::pool().await;
    reset(&pool).await;
    let job = fixture(&pool).await;
    sqlx::query(
        "UPDATE crm_signup_requests SET created_at=now()-interval '2 minutes', \
         code_expires_at=now()-interval '1 minute', \
         expires_at=now()-interval '1 second' WHERE id= \
         (SELECT request_id FROM crm_signup_outbox WHERE id=$1)",
    )
    .bind(job)
    .execute(&pool)
    .await
    .unwrap();
    let claimed = claim(&pool, Uuid::new_v4(), 30).await.unwrap().unwrap();
    assert!(claimed.expired);
    assert!(claimed.code_expired);
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn an_exhausted_job_is_never_claimed_and_cleanup_ends_it() {
    let pool = test_database::pool().await;
    reset(&pool).await;
    let job = fixture(&pool).await;
    sqlx::query("UPDATE crm_signup_outbox SET attempts=$2 WHERE id=$1")
        .bind(job)
        .bind(MAX_ATTEMPTS)
        .execute(&pool)
        .await
        .unwrap();
    assert!(claim(&pool, Uuid::new_v4(), 30).await.unwrap().is_none());
    cleanup::run(&pool).await.unwrap();
    let row: (bool, Option<String>, Option<String>) = sqlx::query_as(
        "SELECT terminal_at IS NOT NULL,last_error,code FROM crm_signup_outbox WHERE id=$1",
    )
    .bind(job)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(row, (true, Some("attempts exhausted".into()), None));
}
