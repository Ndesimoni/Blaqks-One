use super::*;
use crate::test_database;

async fn take(pool: &PgPool, key: &str, seconds: i32) -> ApiResult<()> {
    consume_window(
        pool,
        key,
        1,
        seconds,
        "Synthetic budget exhausted.",
        "signup_busy",
    )
    .await
}

async fn backdate(pool: &PgPool, key: &str, seconds: i32) {
    sqlx::query(
        "UPDATE crm_login_limits SET window_started=now()-$2*interval '1 second' WHERE key_hash=$1",
    )
    .bind(digest(key))
    .bind(seconds)
    .execute(pool)
    .await
    .unwrap();
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn login_cleanup_preserves_valid_hourly_and_daily_windows() {
    let pool = test_database::pool().await;
    let tag = Uuid::new_v4();
    let keys: Vec<_> = ["hour", "day", "expired-hour", "expired-login"]
        .map(|name| format!("signup-{name}:{tag}"))
        .into();
    for (key, seconds, age) in [
        (&keys[0], 3600, 1200),
        (&keys[1], 86400, 1200),
        (&keys[2], 3600, 3601),
        (&keys[3], 900, 901),
    ] {
        take(&pool, key, seconds).await.unwrap();
        backdate(&pool, key, age).await;
    }
    let email = format!("cleanup-{tag}@example.test");
    check(&pool, &email).await.unwrap();
    let hashes: Vec<_> = keys.iter().map(|key| digest(key)).collect();
    let remaining: Vec<String> =
        sqlx::query_scalar("SELECT key_hash FROM crm_login_limits WHERE key_hash=ANY($1)")
            .bind(&hashes)
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(remaining.len(), 2);
    assert!(remaining.contains(&hashes[0]) && remaining.contains(&hashes[1]));
    for key in &keys[..2] {
        let error = take(&pool, key, 900).await.unwrap_err();
        assert_eq!((error.0.as_u16(), error.2), (429, "signup_busy"));
    }
    let mut cleanup = hashes;
    cleanup.push(digest(&format!("email:{email}")));
    sqlx::query("DELETE FROM crm_login_limits WHERE key_hash=ANY($1)")
        .bind(cleanup)
        .execute(&pool)
        .await
        .unwrap();
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn hourly_budget_restarts_only_after_its_own_expiry() {
    let pool = test_database::pool().await;
    let key = format!("signup-hour:{}", Uuid::new_v4());
    take(&pool, &key, 3600).await.unwrap();
    backdate(&pool, &key, 1200).await;
    let error = take(&pool, &key, 900).await.unwrap_err();
    assert_eq!(
        (error.0.as_u16(), error.1, error.2),
        (429, "Synthetic budget exhausted.", "signup_busy")
    );
    let before: (i32, i32) =
        sqlx::query_as("SELECT attempts,window_seconds FROM crm_login_limits WHERE key_hash=$1")
            .bind(digest(&key))
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(before, (2, 3600));
    backdate(&pool, &key, 3601).await;
    take(&pool, &key, 900).await.unwrap();
    let after: (i32, i32) =
        sqlx::query_as("SELECT attempts,window_seconds FROM crm_login_limits WHERE key_hash=$1")
            .bind(digest(&key))
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(after, (1, 900));
    sqlx::query("DELETE FROM crm_login_limits WHERE key_hash=$1")
        .bind(digest(&key))
        .execute(&pool)
        .await
        .unwrap();
}

#[tokio::test]
async fn invalid_budget_configuration_fails_before_connecting() {
    let pool = PgPool::connect_lazy("postgres://unused@127.0.0.1/unused").unwrap();
    for (key, limit, seconds) in [("", 1, 900), ("test", 0, 900), ("test", 1, 0)] {
        let error = consume_window(&pool, key, limit, seconds, SIGN_IN, "rate_limited")
            .await
            .unwrap_err();
        assert_eq!((error.0.as_u16(), error.2), (400, "invalid_request"));
    }
}
