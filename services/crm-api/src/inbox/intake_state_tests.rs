//! Intake contracts for blocked and refused senders, reopening, repeat senders and the
//! automatic-lead cap, on the disposable test database.
use super::matching::AUTO_LEADS_PER_CONNECTION;
use super::{intake::receive, intake_fixtures::company};
use crate::integrations::webhooks::{inbound::SinkError, message::Source};

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

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn a_known_sender_rejoins_their_lead_instead_of_creating_another() {
    let co = company().await;
    let first = co.event("instagram", "t-first", "ig_repeat", "Hi");
    let first = co.sourced(first, Source::Ad, None);
    receive(&co.pool, &first).await.unwrap();
    let second = co.event("instagram", "t-second", "ig_repeat", "Hi again");
    let second = co.sourced(second, Source::Ad, None);
    receive(&co.pool, &second).await.unwrap();
    let (a, b) = (
        co.conversation("t-first").await,
        co.conversation("t-second").await,
    );
    assert_eq!((a.0.as_str(), b.0.as_str()), ("linked", "linked"));
    assert_eq!(a.1, b.1);
    assert_eq!(co.clients().await, 1);
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn automatic_leads_stop_at_the_daily_connection_cap() {
    let co = company().await;
    let busy = co.event("tiktok", "t-busy", "tt_busy", "Hi");
    receive(&co.pool, &busy).await.unwrap();
    sqlx::query(
        "INSERT INTO inbox.crm_inbox_events (id,workspace_id,conversation_id,action) \
         SELECT gen_random_uuid(),c.workspace_id,c.id,'lead_created' \
         FROM inbox.crm_inbox_conversations c, generate_series(1,$2) \
         WHERE c.connection_id=$1",
    )
    .bind(co.connection)
    .bind(AUTO_LEADS_PER_CONNECTION as i32)
    .execute(&co.pool)
    .await
    .unwrap();
    let capped = co.event("tiktok", "t-capped", "tt_new_sender", "Hi");
    let capped = co.sourced(capped, Source::Form, None);
    receive(&co.pool, &capped).await.unwrap();
    let (state, linked, _, _, suggested, _) = co.conversation("t-capped").await;
    assert_eq!((state.as_str(), linked), ("unknown", None));
    assert!(suggested, "beyond the cap the message stays a suggestion");
    assert_eq!(co.clients().await, 0);
}
