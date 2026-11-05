use super::*;
use crate::test_database;

async fn legacy(pool: &PgPool, kind: &str, tag: Uuid) -> ApiResult<()> {
    match kind {
        "email" => check(pool, &format!("synthetic-{tag}@example.test")).await,
        "invitation" => invitation(pool, &tag.to_string()).await,
        _ => password(pool, tag).await,
    }
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn login_invitation_and_password_keep_their_original_budgets_and_errors() {
    let pool = test_database::pool().await;
    for (kind, limit, message) in [
        ("email", 10, SIGN_IN),
        ("invitation", 20, SIGN_IN),
        ("password", 5, PASSWORD),
    ] {
        let tag = Uuid::new_v4();
        let key = match kind {
            "email" => format!("email:synthetic-{tag}@example.test"),
            "invitation" => format!("invitation:{}", digest(&tag.to_string())),
            _ => format!("password:{tag}"),
        };
        for _ in 0..limit {
            legacy(&pool, kind, tag).await.unwrap();
        }
        let error = legacy(&pool, kind, tag).await.unwrap_err();
        assert_eq!(
            (error.0.as_u16(), error.1, error.2),
            (429, message, "rate_limited")
        );
        let row: (i32, i32) = sqlx::query_as(
            "SELECT attempts,window_seconds FROM crm_login_limits WHERE key_hash=$1",
        )
        .bind(digest(&key))
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(row, (limit + 1, 900));
        sqlx::query("UPDATE crm_login_limits SET window_started=now()-interval '901 seconds' WHERE key_hash=$1")
            .bind(digest(&key)).execute(&pool).await.unwrap();
        legacy(&pool, kind, tag).await.unwrap();
        let attempts: i32 =
            sqlx::query_scalar("SELECT attempts FROM crm_login_limits WHERE key_hash=$1")
                .bind(digest(&key))
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(attempts, 1);
        sqlx::query("DELETE FROM crm_login_limits WHERE key_hash=$1")
            .bind(digest(&key))
            .execute(&pool)
            .await
            .unwrap();
    }
}
