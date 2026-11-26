use super::*;
use crate::{auth::password, test_database, workspaces};
use serde_json::{json, Value};
use sqlx::Row;

fn details<'a>(email: &'a str, hash: &'a str) -> NewAdmin<'a> {
    NewAdmin {
        name: " Synthetic Admin ",
        email,
        phone: "+971501234567",
        password_hash: hash,
        language: "ar",
        email_verified: true,
    }
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn creator_always_stores_an_admin_without_membership_or_grants() {
    let pool = test_database::pool().await;
    let mut transaction = pool.begin().await.unwrap();
    let email = format!(" Synthetic-{}@EXAMPLE.TEST ", Uuid::new_v4());
    let hash = password::hash("Synthetic1!test".into()).await.unwrap();
    let id = create_admin(&mut transaction, details(&email, &hash))
        .await
        .unwrap();
    workspaces::create(
        &mut transaction,
        &id.to_string(),
        id,
        id,
        workspaces::company::NewCompany::OPERATOR_BROKERAGE,
    )
    .await
    .unwrap();
    let row = sqlx::query(
        "SELECT *,email_verified_at IS NOT NULL AS verified FROM crm_users WHERE id=$1",
    )
    .bind(id)
    .fetch_one(&mut *transaction)
    .await
    .unwrap();
    assert_eq!(row.get::<String, _>("name"), "Synthetic Admin");
    assert_eq!(row.get::<String, _>("email"), email.trim().to_lowercase());
    assert_eq!(row.get::<String, _>("role"), "admin");
    assert_eq!(row.get::<String, _>("language"), "ar");
    assert_eq!(row.get::<String, _>("password_hash"), hash);
    assert!(row.get::<bool, _>("verified"));
    assert!(row.get::<Option<Uuid>, _>("owner_id").is_none());
    assert!(row.get::<Option<String>, _>("workspace_id").is_none());
    for key in ["permissions", "actions"] {
        assert_eq!(row.get::<Value, _>(key), json!({}));
    }
    assert_eq!(row.get::<Value, _>("positions"), json!([]));
    assert_eq!(
        row.get::<Value, _>("channel_access"),
        json!({"email":false,"whatsapp":false})
    );
    transaction.rollback().await.unwrap();
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM crm_users WHERE id=$1)")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(
        !exists,
        "the caller can roll back the whole account/workspace transaction"
    );
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn bootstrap_style_admin_creation_keeps_email_unverified() {
    let pool = test_database::pool().await;
    let mut transaction = pool.begin().await.unwrap();
    let email = format!("synthetic-{}@example.test", Uuid::new_v4());
    let mut account = details(&email, "already-hashed-synthetic-fixture");
    account.email_verified = false;
    account.language = "en";
    let id = create_admin(&mut transaction, account).await.unwrap();
    let unverified: bool =
        sqlx::query_scalar("SELECT email_verified_at IS NULL FROM crm_users WHERE id=$1")
            .bind(id)
            .fetch_one(&mut *transaction)
            .await
            .unwrap();
    assert!(unverified);
    transaction.rollback().await.unwrap();
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn creator_rejects_invalid_identity_language_and_empty_hash_before_writes() {
    let pool = test_database::pool().await;
    let mut transaction = pool.begin().await.unwrap();
    let mut account = details("invalid-email", "hash");
    assert_eq!(
        create_admin(&mut transaction, account)
            .await
            .unwrap_err()
            .0
            .as_u16(),
        400
    );
    account = details("synthetic@example.test", "hash");
    account.language = "fr";
    assert_eq!(
        create_admin(&mut transaction, account)
            .await
            .unwrap_err()
            .0
            .as_u16(),
        400
    );
    account = details("synthetic@example.test", "");
    assert_eq!(
        create_admin(&mut transaction, account)
            .await
            .unwrap_err()
            .0
            .as_u16(),
        400
    );
    transaction.rollback().await.unwrap();
}
