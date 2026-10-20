//! Intake contracts for blocked senders, refused senders and reopening, on the
//! disposable test database.
use super::{intake::receive, intake_fixtures::company};
use crate::integrations::webhooks::inbound::SinkError;

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn blocked_senders_are_dropped_and_bad_senders_refused() {
    let co = company().await;
    sqlx::query(
        "INSERT INTO inbox.crm_inbox_blocks (workspace_id,channel,contact_key,created_by) \
         VALUES ($1,'whatsapp','+971500009999',$2)",
    )
    .bind(&co.workspace)
    .bind(co.owner)
    .execute(&co.pool)
    .await
    .unwrap();
    let blocked = co.event(
        "whatsapp",
        "t-blocked",
        "050 000 9999",
        "Buy villa apartment",
    );
    receive(&co.pool, &blocked).await.unwrap();
    let stored: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM inbox.crm_inbox_conversations WHERE workspace_id=$1",
    )
    .bind(&co.workspace)
    .fetch_one(&co.pool)
    .await
    .unwrap();
    assert_eq!(stored, 0);
    let bad = co.event("whatsapp", "t-bad", "not a phone", "Hi");
    assert_eq!(
        receive(&co.pool, &bad).await,
        Err(SinkError::Permanent("invalid_sender"))
    );
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn a_new_message_reopens_a_resolved_conversation() {
    let co = company().await;
    let first = co.event("tiktok", "t-reopen", "tt_user_2", "Hi");
    receive(&co.pool, &first).await.unwrap();
    sqlx::query("UPDATE inbox.crm_inbox_conversations SET state='resolved' WHERE external_thread_id='t-reopen' AND connection_id=$1")
        .bind(co.connection)
        .execute(&co.pool)
        .await
        .unwrap();
    let second = co.event("tiktok", "t-reopen", "tt_user_2", "Me again");
    receive(&co.pool, &second).await.unwrap();
    let (_, _, _, status, _, messages) = co.conversation("t-reopen").await;
    assert_eq!((status.as_str(), messages), ("open", 2));
}
