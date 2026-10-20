//! The only reader of a sealed connection credential (design §8). It opens a credential
//! for an adapter call (send, history, revoke) and never returns it to a handler response.
use super::{crypto, model::ConnectionRow};
use crate::{config::messaging_settings::MessagingKey, error::ApiResult};
use sqlx::{Postgres, Row, Transaction};

/// The plain credential of a live connection, or `None` when it is disconnected, sealed
/// under a key version this process does not hold, or fails to open.
#[allow(dead_code)] // The E1b sender and E1c reader open tokens through here.
pub async fn open(
    tx: &mut Transaction<'_, Postgres>,
    key: &MessagingKey,
    row: &ConnectionRow,
) -> ApiResult<Option<String>> {
    let sealed = sqlx::query(
        "SELECT credential_sealed,credential_key_version
         FROM integrations.crm_channel_connections
         WHERE workspace_id=$1 AND id=$2 AND state<>'disconnected'",
    )
    .bind(&row.workspace_id)
    .bind(row.id)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(sealed) = sealed else {
        return Ok(None);
    };
    let (bytes, version): (Option<Vec<u8>>, Option<i32>) = (
        sealed.get("credential_sealed"),
        sealed.get("credential_key_version"),
    );
    let (Some(bytes), Some(version)) = (bytes, version) else {
        return Ok(None);
    };
    if version != key.version {
        return Ok(None);
    }
    let aad = crypto::aad(
        &row.workspace_id,
        &row.id.to_string(),
        &row.provider,
        &row.channel,
        version,
    );
    Ok(crypto::open(&key.bytes, &aad, &bytes)
        .ok()
        .and_then(|plain| String::from_utf8(plain).ok()))
}
