use super::model::FREE_MEMBER_LIMIT;
use super::*;
use crate::{test_database, workspaces};
use uuid::Uuid;

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn workspace_creation_derives_profile_and_redacted_history_and_rolls_back_together() {
    let pool = test_database::pool().await;
    let mut transaction = pool.begin().await.unwrap();
    let mut created = Vec::new();
    for origin in [Origin::Operator, Origin::Signup] {
        let kind = AccountType::Brokerage;
        let owner = test_support::admin(&mut transaction).await;
        let actor = test_support::admin(&mut transaction).await;
        let workspace = owner.to_string();
        workspaces::create(
            &mut transaction,
            &workspace,
            owner,
            actor,
            NewCompany {
                account_type: kind,
                origin,
            },
        )
        .await
        .unwrap();
        let company = get(&mut *transaction, &workspace).await.unwrap();
        assert_eq!(company.account_type, kind.name());
        assert_eq!(company.member_limit, Some(FREE_MEMBER_LIMIT));
        assert_eq!(company.version, 1);
        assert!(!company.setup_complete);
        assert!(company.display_name.is_none() && company.emirate.is_none());
        let stored_origin: String =
            sqlx::query_scalar("SELECT origin FROM crm_company_profiles WHERE workspace_id=$1")
                .bind(&workspace)
                .fetch_one(&mut *transaction)
                .await
                .unwrap();
        assert_eq!(stored_origin, origin.name());
        let event: (Uuid, String, Option<String>, Option<String>) = sqlx::query_as(
            "SELECT actor_id,action,from_type,to_type FROM crm_company_events WHERE workspace_id=$1",
        ).bind(&workspace).fetch_one(&mut *transaction).await.unwrap();
        assert_eq!(
            event,
            (actor, "created".into(), None, Some(kind.name().into()))
        );
        created.push(workspace);
    }
    // No committed evidence or workspace may survive a caller's failure.
    transaction.rollback().await.unwrap();
    let remaining: (i64, i64, i64) = sqlx::query_as(
        "SELECT (SELECT count(*) FROM crm_workspaces WHERE id=ANY($1)), \
         (SELECT count(*) FROM crm_company_profiles WHERE workspace_id=ANY($1)), \
         (SELECT count(*) FROM crm_company_events WHERE workspace_id=ANY($1))",
    )
    .bind(created)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(remaining, (0, 0, 0));
}
