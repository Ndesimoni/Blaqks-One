//! Disconnecting a connection and owing a mailbox's revocation to the provider (security
//! review M1, L3). Every disconnect, by the member, the Admin, or because the member left
//! or lost the email grant (`departure.rs`), clears the connection in the caller's
//! transaction and queues the sealed token unchanged. `drain` revokes after commit and the
//! messaging worker retries.
use super::{crypto, google::oauth, model::ConnectionRow, store_write};
use crate::{
    config::{google_settings::GoogleConfig, messaging_settings::MessagingKey},
    error::ApiResult,
};
use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

const BATCH: i64 = 20;
const MAX_ATTEMPTS: i32 = 8;

/// Queues the revocation (Google rows only), then disconnects and clears the row.
pub async fn disconnect(
    tx: &mut Transaction<'_, Postgres>,
    row: &ConnectionRow,
    actor: Uuid,
) -> ApiResult<Option<ConnectionRow>> {
    sqlx::query(
        "INSERT INTO integrations.crm_pending_revocations
         (connection_id,workspace_id,provider,channel,credential_sealed,credential_key_version)
         SELECT id,workspace_id,provider,channel,credential_sealed,credential_key_version
         FROM integrations.crm_channel_connections
         WHERE workspace_id=$1 AND id=$2 AND provider='google' AND state<>'disconnected'
           AND credential_sealed IS NOT NULL
         ON CONFLICT (connection_id) DO NOTHING",
    )
    .bind(&row.workspace_id)
    .bind(row.id)
    .execute(&mut **tx)
    .await?;
    // The company's Twilio account takes every member's number with it (W1a, §4.5).
    if row.provider == "twilio" {
        super::numbers::write::end_connection(tx, &row.workspace_id, row.id, actor).await?;
    }
    let updated = store_write::set_disconnected(tx, &row.workspace_id, row.id, actor).await?;
    store_write::event(tx, &row.workspace_id, row.id, "disconnected", actor).await?;
    Ok(updated)
}

/// A fresh sign-in to the same Google account cancels revocations still queued for it:
/// revoking ends the person's whole grant, which now serves the new connection.
pub async fn cancel_for(tx: &mut Transaction<'_, Postgres>, address: &str) -> ApiResult<()> {
    sqlx::query(
        "DELETE FROM integrations.crm_pending_revocations pending
         USING integrations.crm_channel_connections connection
         WHERE pending.connection_id=connection.id AND connection.provider='google'
           AND connection.external_account_id=$1",
    )
    .bind(address)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Revokes what is due. A row that cannot be opened (an unknown key version) is dropped,
/// because no process can revoke it; the connection is already cleared either way.
pub async fn drain(pool: &PgPool, key: &MessagingKey, google: &GoogleConfig) -> ApiResult<()> {
    let mut tx = pool.begin().await?;
    let due = sqlx::query(
        "SELECT connection_id,workspace_id,provider,channel,credential_sealed,
                credential_key_version,attempts
         FROM integrations.crm_pending_revocations WHERE next_attempt_at<=now()
         ORDER BY next_attempt_at LIMIT $1 FOR UPDATE SKIP LOCKED",
    )
    .bind(BATCH)
    .fetch_all(&mut *tx)
    .await?;
    for row in due {
        let id: Uuid = row.get("connection_id");
        let workspace: String = row.get("workspace_id");
        let version: i32 = row.get("credential_key_version");
        let aad = crypto::aad(
            &workspace,
            &id.to_string(),
            row.get("provider"),
            row.get("channel"),
            version,
        );
        let token = (version == key.version)
            .then(|| crypto::open(&key.bytes, &aad, row.get("credential_sealed")).ok())
            .flatten()
            .and_then(|plain| String::from_utf8(plain).ok());
        let done = match token {
            Some(token) => oauth::revoke(google, &token).await,
            None => true,
        };
        let attempts: i32 = row.get("attempts");
        let finished = done || attempts + 1 >= MAX_ATTEMPTS;
        let sql = if finished {
            "DELETE FROM integrations.crm_pending_revocations WHERE connection_id=$1"
        } else {
            "UPDATE integrations.crm_pending_revocations SET attempts=attempts+1,
             next_attempt_at=now()+make_interval(mins=>power(2,attempts)::int)
             WHERE connection_id=$1"
        };
        sqlx::query(sql).bind(id).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

/// After an API commit: revoke now, without holding the request open.
pub fn drain_soon(pool: PgPool, key: Option<MessagingKey>, google: Option<GoogleConfig>) {
    if let (Some(key), Some(google)) = (key, google) {
        tokio::spawn(async move {
            let _ = drain(&pool, &key, &google).await;
        });
    }
}

/// The messaging worker's retry loop: once a minute until shutdown.
pub fn spawn(
    pool: PgPool,
    key: MessagingKey,
    google: GoogleConfig,
    mut shutdown: tokio::sync::watch::Receiver<bool>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            if drain(&pool, &key, &google).await.is_err() {
                eprintln!("CRM mailbox revocation retry failed.");
            }
            let minute = std::time::Duration::from_secs(60);
            if crate::outbox::worker::pause(&mut shutdown, minute).await {
                break;
            }
        }
    })
}
