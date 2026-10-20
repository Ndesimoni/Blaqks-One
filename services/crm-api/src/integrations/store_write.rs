//! Versioned writes for the connections registry, kept apart from the reads so each
//! file stays small. The sealed credential is written only here.
use super::model::ConnectionRow;
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn set_connected(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    id: Uuid,
    sealed: &[u8],
    key_version: i32,
    actor: Uuid,
) -> ApiResult<Option<ConnectionRow>> {
    sqlx::query(
        "UPDATE integrations.crm_channel_connections
         SET credential_sealed=$3,credential_key_version=$4,credential_updated_at=now(),
             state='connected',updated_by=$5,updated_at=now(),version=version+1
         WHERE workspace_id=$1 AND id=$2 AND state<>'disconnected'",
    )
    .bind(workspace)
    .bind(id)
    .bind(sealed)
    .bind(key_version)
    .bind(actor)
    .execute(&mut **tx)
    .await?;
    super::store::load(tx, workspace, id).await
}

/// Disconnect clears the credential in the same statement; history stays.
pub async fn set_disconnected(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    id: Uuid,
    actor: Uuid,
) -> ApiResult<Option<ConnectionRow>> {
    sqlx::query(
        "UPDATE integrations.crm_channel_connections
         SET state='disconnected',credential_sealed=NULL,credential_key_version=NULL,
             credential_updated_at=NULL,updated_by=$3,updated_at=now(),version=version+1
         WHERE workspace_id=$1 AND id=$2 AND state<>'disconnected'",
    )
    .bind(workspace)
    .bind(id)
    .bind(actor)
    .execute(&mut **tx)
    .await?;
    super::store::load(tx, workspace, id).await
}

/// Google refused the stored token: the mailbox stays, but needs its owner to sign in
/// again. Returns whether this call changed the state.
pub async fn set_reconnect_required(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    id: Uuid,
) -> ApiResult<bool> {
    let changed = sqlx::query(
        "UPDATE integrations.crm_channel_connections
         SET state='reconnect_required',updated_at=now(),version=version+1
         WHERE workspace_id=$1 AND id=$2 AND state='connected'",
    )
    .bind(workspace)
    .bind(id)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    Ok(changed == 1)
}

pub async fn event(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    connection: Uuid,
    action: &str,
    actor: Uuid,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO integrations.crm_integration_events
         (id,workspace_id,connection_id,action,actor_id)
         VALUES ($1,$2,$3,$4,$5)",
    )
    .bind(Uuid::new_v4())
    .bind(workspace)
    .bind(connection)
    .bind(action)
    .bind(actor)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
