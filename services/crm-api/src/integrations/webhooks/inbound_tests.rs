//! Inbound processing contracts on the disposable test database (design §7, SEC-3).
use super::{
    cleanup::purge,
    inbound::{process_one, SinkError},
    inbound_fixtures::{fresh, outcome, stored_event, stub_body, Recorder, KEY},
};
use crate::config::messaging_settings::MessagingKey;
use uuid::Uuid;

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn a_replayed_event_is_stored_and_processed_once() {
    let pool = fresh().await;
    let receipt = stored_event(&pool, &stub_body("synthetic")).await;
    let sink = Recorder::new(vec![Err(SinkError::Retry), Ok(())]);
    let owner = Uuid::new_v4();
    assert!(process_one(&pool, &KEY, &sink, owner).await);
    assert_eq!(outcome(&pool, receipt).await, ("received".into(), None, 1));
    assert!(process_one(&pool, &KEY, &sink, owner).await);
    assert_eq!(outcome(&pool, receipt).await, ("processed".into(), None, 0));
    assert!(!process_one(&pool, &KEY, &sink, owner).await);
    assert_eq!(sink.texts.lock().unwrap()[1], "synthetic");
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn refused_unreadable_and_disconnected_events_end_without_their_body() {
    let pool = fresh().await;
    let refused = stored_event(&pool, &stub_body("refused")).await;
    let sink = Recorder::new(vec![Err(SinkError::Permanent("unsupported_event"))]);
    process_one(&pool, &KEY, &sink, Uuid::new_v4()).await;
    let code = Some("unsupported_event".to_owned());
    assert_eq!(outcome(&pool, refused).await, ("failed".into(), code, 0));
    let garbled = stored_event(&pool, b"{}").await;
    process_one(&pool, &KEY, &sink, Uuid::new_v4()).await;
    let code = Some("unparseable".to_owned());
    assert_eq!(outcome(&pool, garbled).await, ("failed".into(), code, 0));
    let unreadable = stored_event(&pool, b"{}").await;
    let rotated = MessagingKey {
        bytes: [6u8; 32],
        version: 2,
    };
    process_one(&pool, &rotated, &sink, Uuid::new_v4()).await;
    let code = Some("unreadable".to_owned());
    assert_eq!(outcome(&pool, unreadable).await, ("failed".into(), code, 0));
    let gone = stored_event(&pool, b"{}").await;
    sqlx::query(
        "UPDATE integrations.crm_channel_connections SET state='disconnected', \
           credential_sealed=NULL,credential_key_version=NULL \
         WHERE id=(SELECT connection_id FROM integrations.crm_webhook_receipts WHERE id=$1)",
    )
    .bind(gone)
    .execute(&pool)
    .await
    .unwrap();
    process_one(&pool, &KEY, &sink, Uuid::new_v4()).await;
    let code = Some("disconnected".to_owned());
    assert_eq!(outcome(&pool, gone).await, ("rejected".into(), code, 0));
    assert_eq!(sink.texts.lock().unwrap().len(), 1);
    sqlx::query(
        "UPDATE integrations.crm_webhook_receipts SET received_at=now()-interval '31 days'",
    )
    .execute(&pool)
    .await
    .unwrap();
    assert_eq!(purge(&pool).await.unwrap(), 4);
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn an_event_that_used_every_claim_ends_and_loses_its_body() {
    let pool = fresh().await;
    let stuck = stored_event(&pool, b"{}").await;
    sqlx::query(
        "UPDATE integrations.crm_webhook_receipts SET attempts=5,lease_owner=$2, \
           lease_expires_at=now()-interval '1 second' WHERE id=$1",
    )
    .bind(stuck)
    .bind(Uuid::new_v4())
    .execute(&pool)
    .await
    .unwrap();
    let sink = Recorder::new(Vec::new());
    assert!(!process_one(&pool, &KEY, &sink, Uuid::new_v4()).await);
    let code = Some("attempts_exhausted".to_owned());
    assert_eq!(outcome(&pool, stuck).await, ("failed".into(), code, 0));
}
