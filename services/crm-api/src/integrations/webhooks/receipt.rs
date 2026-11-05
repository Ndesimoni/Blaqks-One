//! Stores a verified event: one receipt per `(connection, event_id)` and the body sealed in
//! a staging row, in one transaction. A replay finds the receipt and stores nothing new.
use super::stub::Verified;
use crate::{config::messaging_settings::MessagingKey, error::ApiResult, integrations::crypto};
use sqlx::PgPool;
use uuid::Uuid;

/// The receipts' provider name for events from the local stub.
pub const STUB: &str = "stub";

/// Returns `true` when the event is new, `false` for a replay.
pub async fn store(
    pool: &PgPool,
    key: &MessagingKey,
    verified: &Verified,
    body: &[u8],
) -> ApiResult<bool> {
    let id = Uuid::new_v4();
    let workspace = &verified.connection.workspace_id;
    let aad = crypto::staging_aad(workspace, &id.to_string(), STUB, key.version);
    let sealed = crypto::seal(&key.bytes, &aad, body).map_err(|_| super::rejected())?;
    let mut transaction = pool.begin().await?;
    let inserted: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO integrations.crm_webhook_receipts \
           (id,provider,event_id,workspace_id,connection_id) \
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (connection_id,event_id) DO NOTHING RETURNING id",
    )
    .bind(id)
    .bind(STUB)
    .bind(&verified.event_id)
    .bind(workspace)
    .bind(verified.connection.id)
    .fetch_optional(&mut *transaction)
    .await?;
    if inserted.is_some() {
        sqlx::query(
            "INSERT INTO integrations.crm_webhook_staging (receipt_id,payload_sealed,key_version) \
             VALUES ($1,$2,$3)",
        )
        .bind(id)
        .bind(&sealed)
        .bind(key.version)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;
    Ok(inserted.is_some())
}
