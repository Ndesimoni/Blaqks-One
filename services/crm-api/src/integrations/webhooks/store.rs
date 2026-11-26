//! The one read of a sealed credential, for webhook verification. `Secret` has no `Debug`
//! or `Serialize`, so it cannot be logged or returned.
use crate::error::ApiResult;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(FromRow)]
pub struct Secret {
    pub id: Uuid,
    pub workspace_id: String,
    pub provider: String,
    pub channel: String,
    pub sealed: Vec<u8>,
    pub key_version: i32,
}

/// The live connection that holds `account` at `provider`. Disconnected rows have no
/// credential, so their events can never verify.
pub async fn secret(pool: &PgPool, provider: &str, account: &str) -> ApiResult<Option<Secret>> {
    sqlx::query_as(
        "SELECT id,workspace_id,provider,channel,credential_sealed AS sealed, \
           credential_key_version AS key_version \
         FROM integrations.crm_channel_connections \
         WHERE provider=$1 AND external_account_id=$2 AND state<>'disconnected' \
           AND credential_sealed IS NOT NULL AND credential_key_version IS NOT NULL",
    )
    .bind(provider)
    .bind(account)
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}
