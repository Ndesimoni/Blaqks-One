//! SQL for the connections registry. This module owns `integrations.crm_*`; it never
//! selects the sealed credential, so no application row can leak it (design §8).
use super::model::ConnectionRow;
use crate::error::{ApiError, ApiResult};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const ACCOUNT_TAKEN: &str = "This account is already connected to a company.";
pub const ALREADY_CONNECTED: &str = "This channel is already connected. Disconnect it first.";

const SELECT: &str = "SELECT id,workspace_id,channel,provider,external_account_id,display_label,
    owner_member_id,state,credential_key_version,
    to_char(credential_updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
        AS credential_updated_at,
    version,
    to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at,
    to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS updated_at
    FROM integrations.crm_channel_connections";

pub async fn list(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
) -> ApiResult<Vec<ConnectionRow>> {
    sqlx::query_as::<_, ConnectionRow>(&format!(
        "{SELECT} WHERE workspace_id=$1 ORDER BY channel,created_at"
    ))
    .bind(workspace)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}

/// A row in another company is indistinguishable from a missing one.
pub async fn load(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    id: Uuid,
) -> ApiResult<Option<ConnectionRow>> {
    sqlx::query_as::<_, ConnectionRow>(&format!("{SELECT} WHERE workspace_id=$1 AND id=$2"))
        .bind(workspace)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(Into::into)
}

pub struct NewConnection<'a> {
    pub id: Uuid,
    pub workspace_id: &'a str,
    pub channel: &'a str,
    pub provider: &'a str,
    pub external_account_id: &'a str,
    pub display_label: &'a str,
    pub owner_member_id: Option<Uuid>,
    pub sealed: &'a [u8],
    pub key_version: i32,
    pub actor: Uuid,
}

pub async fn insert(tx: &mut Transaction<'_, Postgres>, new: &NewConnection<'_>) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO integrations.crm_channel_connections
         (id,workspace_id,channel,provider,external_account_id,display_label,
          owner_member_id,state,credential_sealed,credential_key_version,
          credential_updated_at,version,created_by,updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'connected',$8,$9,now(),1,$10,$10)",
    )
    .bind(new.id)
    .bind(new.workspace_id)
    .bind(new.channel)
    .bind(new.provider)
    .bind(new.external_account_id)
    .bind(new.display_label)
    .bind(new.owner_member_id)
    .bind(new.sealed)
    .bind(new.key_version)
    .bind(new.actor)
    .execute(&mut **tx)
    .await
    .map_err(write_error)?;
    Ok(())
}

fn write_error(error: sqlx::Error) -> ApiError {
    if let Some(database) = error.as_database_error() {
        if database.code().as_deref() == Some("23505") {
            return match database.constraint() {
                Some("crm_channel_connections_external") => ApiError::conflict(ACCOUNT_TAKEN),
                _ => ApiError::conflict(ALREADY_CONNECTED),
            };
        }
    }
    error.into()
}

/// Each channel's live connection state in a company (`connected` or
/// `reconnect_required`), for the Inbox's status banners. No labels or account IDs.
pub async fn channel_states(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
) -> ApiResult<Vec<(String, String)>> {
    sqlx::query_as(
        "SELECT channel,state FROM integrations.crm_channel_connections \
         WHERE workspace_id=$1 AND state<>'disconnected' ORDER BY channel",
    )
    .bind(workspace)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}
