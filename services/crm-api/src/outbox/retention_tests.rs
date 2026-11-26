//! Outbox retention on the disposable test database (design §9).
use super::{
    cleanup::purge,
    db_tests::{fresh, queued, state},
};

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn finished_jobs_are_purged_after_thirty_days_and_live_ones_never() {
    let pool = fresh().await;
    let (old, _) = queued(&pool).await;
    let (live, _) = queued(&pool).await;
    sqlx::query(
        "UPDATE outbox.crm_outbox_jobs SET state='done',finished_at=now()-interval '31 days' \
         WHERE id=$1",
    )
    .bind(old)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "UPDATE outbox.crm_outbox_jobs SET created_at=now()-interval '60 days' WHERE id=$1",
    )
    .bind(live)
    .execute(&pool)
    .await
    .unwrap();
    assert_eq!(purge(&pool).await.unwrap(), 1);
    assert_eq!(state(&pool, live).await.0, "pending");
}
