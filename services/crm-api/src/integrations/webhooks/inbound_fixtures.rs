//! Inbound test fixtures: a scripted sink and a stored event on a live stub connection.
use super::{
    inbound::{Event, Sink, SinkError, SinkFuture},
    receipt, store,
    stub::Verified,
};
use crate::{config::messaging_settings::MessagingKey, integrations::crypto, test_database};
use sqlx::PgPool;
use std::sync::Mutex;
use uuid::Uuid;

pub const KEY: MessagingKey = MessagingKey {
    bytes: [5u8; 32],
    version: 1,
};

/// A sink that answers with scripted results and keeps the texts it accepted.
pub struct Recorder {
    answers: Mutex<Vec<Result<(), SinkError>>>,
    pub texts: Mutex<Vec<String>>,
}

impl Recorder {
    pub fn new(answers: Vec<Result<(), SinkError>>) -> Self {
        Self {
            answers: Mutex::new(answers),
            texts: Mutex::new(Vec::new()),
        }
    }
}

impl Sink for Recorder {
    fn accept<'a>(&'a self, event: &'a Event) -> SinkFuture<'a> {
        self.texts.lock().unwrap().push(event.message.text.clone());
        let answer = self.answers.lock().unwrap().remove(0);
        Box::pin(async move { answer })
    }
}

/// A live stub WhatsApp connection with a sealed credential, and one stored event.
pub async fn stored_event(pool: &PgPool, body: &[u8]) -> Uuid {
    let (id, account) = (
        Uuid::new_v4(),
        format!("+9715{}", &Uuid::new_v4().simple().to_string()[..8]),
    );
    let workspace = format!("ws-inbound-{}", id.simple());
    let aad = crypto::aad(&workspace, &id.to_string(), "twilio", "whatsapp", 1);
    let sealed = crypto::seal(&KEY.bytes, &aad, b"synthetic-secret").unwrap();
    sqlx::query(
        "INSERT INTO integrations.crm_channel_connections (id,workspace_id,channel,provider, \
           external_account_id,display_label,state,credential_sealed,credential_key_version, \
           version,created_by,updated_by) \
         VALUES ($1,$4,'whatsapp','twilio',$2,'Inbound test','connected',$3,1,1,$1,$1)",
    )
    .bind(id)
    .bind(&account)
    .bind(&sealed)
    .bind(&workspace)
    .execute(pool)
    .await
    .unwrap();
    let connection = store::secret(pool, "twilio", &account)
        .await
        .unwrap()
        .unwrap();
    let event_id = format!("evt-{}", Uuid::new_v4().simple());
    let verified = Verified {
        connection,
        event_id,
    };
    assert!(receipt::store(pool, &KEY, &verified, body).await.unwrap());
    assert!(!receipt::store(pool, &KEY, &verified, body).await.unwrap());
    sqlx::query_scalar("SELECT id FROM integrations.crm_webhook_receipts WHERE event_id=$1")
        .bind(&verified.event_id)
        .fetch_one(pool)
        .await
        .unwrap()
}

pub async fn fresh() -> PgPool {
    let pool = test_database::pool().await;
    sqlx::query("DELETE FROM integrations.crm_webhook_receipts")
        .execute(&pool)
        .await
        .unwrap();
    pool
}

pub async fn outcome(pool: &PgPool, receipt: Uuid) -> (String, Option<String>, i64) {
    sqlx::query_as(
        "SELECT r.outcome,r.failure_code,(SELECT count(*) FROM integrations.crm_webhook_staging s \
           WHERE s.receipt_id=r.id) FROM integrations.crm_webhook_receipts r WHERE r.id=$1",
    )
    .bind(receipt)
    .fetch_one(pool)
    .await
    .unwrap()
}

/// A valid stub message body with this text.
pub fn stub_body(text: &str) -> Vec<u8> {
    serde_json::json!({"thread": "t-1", "message": "m-1", "from": "+971500000001", "text": text})
        .to_string()
        .into_bytes()
}
