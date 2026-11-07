use super::*;
use crate::{test_database, workspaces};
use sqlx::Acquire;

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn company_limit_rejects_null_and_invalid_seats_and_history_cannot_change() {
    let pool = test_database::pool().await;
    let mut transaction = pool.begin().await.unwrap();
    let owner = test_support::admin(&mut transaction).await;
    let workspace = owner.to_string();
    workspaces::create(
        &mut transaction,
        &workspace,
        owner,
        owner,
        NewCompany {
            account_type: AccountType::Brokerage,
            origin: Origin::Signup,
        },
    )
    .await
    .unwrap();
    for seats in [None, Some(0)] {
        let mut savepoint = transaction.begin().await.unwrap();
        let error =
            sqlx::query("UPDATE crm_company_profiles SET member_limit=$2 WHERE workspace_id=$1")
                .bind(&workspace)
                .bind(seats)
                .execute(&mut *savepoint)
                .await
                .unwrap_err();
        assert_eq!(
            error.as_database_error().unwrap().code().as_deref(),
            Some("23514")
        );
        savepoint.rollback().await.unwrap();
    }
    for statement in [
        format!("UPDATE crm_company_events SET action='created' WHERE workspace_id='{workspace}'"),
        format!("DELETE FROM crm_company_events WHERE workspace_id='{workspace}'"),
        "TRUNCATE crm_company_events".into(),
    ] {
        let mut savepoint = transaction.begin().await.unwrap();
        let error = sqlx::query(&statement)
            .execute(&mut *savepoint)
            .await
            .unwrap_err();
        assert_eq!(
            error.as_database_error().unwrap().code().as_deref(),
            Some("P0001")
        );
        savepoint.rollback().await.unwrap();
    }
    transaction.rollback().await.unwrap();
}
