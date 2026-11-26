use super::*;
use crate::{
    auth::{
        account::events::{self, Action},
        accounts::{self, NewAdmin},
    },
    test_database, workspaces,
};
use sqlx::{Acquire, Row};

#[test]
fn consent_versions_must_be_present_and_current() {
    assert!(validate(TERMS_VERSION, PRIVACY_VERSION).is_ok());
    for (terms, privacy) in [("", PRIVACY_VERSION), (TERMS_VERSION, " ")] {
        let error = validate(terms, privacy).unwrap_err();
        assert_eq!((error.0.as_u16(), error.2), (400, "consent_required"));
    }
    for (terms, privacy) in [("old", PRIVACY_VERSION), (TERMS_VERSION, "old")] {
        let error = validate(terms, privacy).unwrap_err();
        assert_eq!((error.0.as_u16(), error.2), (409, "consent_outdated"));
    }
}

async fn refused(transaction: &mut Transaction<'_, Postgres>, statement: &str, code: &str) {
    let mut savepoint = transaction.begin().await.unwrap();
    let error = sqlx::query(statement)
        .execute(&mut *savepoint)
        .await
        .unwrap_err();
    assert_eq!(
        error.as_database_error().unwrap().code().as_deref(),
        Some(code)
    );
    savepoint.rollback().await.unwrap();
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn consent_evidence_and_signup_event_are_immutable_and_roll_back_with_creation() {
    let pool = test_database::pool().await;
    let mut transaction = pool.begin().await.unwrap();
    let email = format!("synthetic-{}@example.test", Uuid::new_v4());
    let user = accounts::create_admin(
        &mut transaction,
        NewAdmin {
            name: "Synthetic Consent",
            email: &email,
            phone: "+971501234567",
            password_hash: "already-hashed-synthetic-fixture",
            language: "en",
            email_verified: true,
        },
    )
    .await
    .unwrap();
    let workspace = user.to_string();
    workspaces::create(
        &mut transaction,
        &workspace,
        user,
        user,
        workspaces::company::NewCompany::OPERATOR_BROKERAGE,
    )
    .await
    .unwrap();
    record(&mut transaction, user, TERMS_VERSION, PRIVACY_VERSION)
        .await
        .unwrap();
    events::append(&mut transaction, user, user, &workspace, Action::SignedUp)
        .await
        .unwrap();
    let rows = sqlx::query(
        "SELECT document,version,accepted_at=transaction_timestamp() AS server_time \
         FROM crm_account_consents WHERE user_id=$1 ORDER BY document",
    )
    .bind(user)
    .fetch_all(&mut *transaction)
    .await
    .unwrap();
    assert_eq!(rows.len(), 2);
    for (row, document, version) in [
        (&rows[0], "privacy", PRIVACY_VERSION),
        (&rows[1], "terms", TERMS_VERSION),
    ] {
        assert_eq!(row.get::<String, _>("document"), document);
        assert_eq!(row.get::<String, _>("version"), version);
        assert!(row.get::<bool, _>("server_time"));
    }
    for statement in [
        format!("UPDATE crm_account_consents SET version='changed' WHERE user_id='{user}'"),
        format!("DELETE FROM crm_account_consents WHERE user_id='{user}'"),
        "TRUNCATE crm_account_consents".into(),
    ] {
        refused(&mut transaction, &statement, "P0001").await;
    }
    for (document, version) in [("marketing", "v1"), ("terms", " ")] {
        let statement = format!(
            "INSERT INTO crm_account_consents(user_id,document,version) \
            VALUES ('{user}','{document}','{version}')"
        );
        refused(&mut transaction, &statement, "23514").await;
    }
    let mut savepoint = transaction.begin().await.unwrap();
    let duplicate = record(&mut savepoint, user, TERMS_VERSION, PRIVACY_VERSION)
        .await
        .unwrap_err();
    assert_eq!(duplicate.0.as_u16(), 409);
    savepoint.rollback().await.unwrap();
    let event: (Uuid, Uuid, String, String) = sqlx::query_as(
        "SELECT user_id,actor_id,workspace_id,action FROM crm_account_events WHERE user_id=$1",
    )
    .bind(user)
    .fetch_one(&mut *transaction)
    .await
    .unwrap();
    assert_eq!(event, (user, user, workspace, "signed_up".into()));
    transaction.rollback().await.unwrap();
    let remaining: (i64, i64, i64) = sqlx::query_as(
        "SELECT (SELECT count(*) FROM crm_users WHERE id=$1), \
         (SELECT count(*) FROM crm_account_consents WHERE user_id=$1), \
         (SELECT count(*) FROM crm_account_events WHERE user_id=$1)",
    )
    .bind(user)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(remaining, (0, 0, 0));
}
