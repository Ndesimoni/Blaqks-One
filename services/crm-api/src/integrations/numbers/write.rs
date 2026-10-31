//! Disconnecting WhatsApp numbers, one by one or as a hook (design §4, W-M1 and W-L6). A
//! number is never deleted or handed on: it becomes `disconnected`, keeps its history, and
//! intake stops. Each disconnect writes one redacted `number_disconnected` event against
//! the company connection: no phone number, member or sender.
use super::store::{self, NumberRow};
use crate::{error::ApiResult, integrations::store_write};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'a, 'b> = &'a mut Transaction<'b, Postgres>;

pub const CONNECTED: &str = "number_connected";
pub const DISCONNECTED: &str = "number_disconnected";

/// `None` when the number changed since `found` was read.
pub async fn disconnect(
    tx: Tx<'_, '_>,
    workspace: &str,
    found: &NumberRow,
    actor: Uuid,
) -> ApiResult<Option<NumberRow>> {
    let ended: Vec<Uuid> = sqlx::query_scalar(
        "UPDATE integrations.crm_whatsapp_numbers
         SET state='disconnected',version=version+1,updated_by=$4,updated_at=now()
         WHERE workspace_id=$1 AND id=$2 AND version=$3 AND state='active'
         RETURNING connection_id",
    )
    .bind(workspace)
    .bind(found.id)
    .bind(found.version)
    .bind(actor)
    .fetch_all(&mut **tx)
    .await?;
    if ended.is_empty() {
        return Ok(None);
    }
    events(tx, workspace, &ended, actor).await?;
    store::by_id(tx, workspace, found.id).await
}

/// Members who leave, are suspended or lose the WhatsApp grant lose their numbers in the
/// caller's transaction. Called from `departure`.
pub async fn end_members(
    tx: Tx<'_, '_>,
    workspace: &str,
    members: &[Uuid],
    actor: Uuid,
) -> ApiResult<()> {
    let ended: Vec<Uuid> = sqlx::query_scalar(
        "UPDATE integrations.crm_whatsapp_numbers
         SET state='disconnected',version=version+1,updated_by=$3,updated_at=now()
         WHERE workspace_id=$1 AND member_id=ANY($2) AND state='active'
         RETURNING connection_id",
    )
    .bind(workspace)
    .bind(members)
    .bind(actor)
    .fetch_all(&mut **tx)
    .await?;
    events(tx, workspace, &ended, actor).await
}

/// Disconnecting the company's Twilio account disconnects every number on it. Called from
/// `revocation::disconnect`, so the Admin's disconnect and an Admin archive both cascade.
pub async fn end_connection(
    tx: Tx<'_, '_>,
    workspace: &str,
    connection: Uuid,
    actor: Uuid,
) -> ApiResult<()> {
    let ended: Vec<Uuid> = sqlx::query_scalar(
        "UPDATE integrations.crm_whatsapp_numbers
         SET state='disconnected',version=version+1,updated_by=$3,updated_at=now()
         WHERE workspace_id=$1 AND connection_id=$2 AND state='active'
         RETURNING connection_id",
    )
    .bind(workspace)
    .bind(connection)
    .bind(actor)
    .fetch_all(&mut **tx)
    .await?;
    events(tx, workspace, &ended, actor).await
}

async fn events(tx: Tx<'_, '_>, workspace: &str, ended: &[Uuid], actor: Uuid) -> ApiResult<()> {
    for connection in ended {
        store_write::event(tx, workspace, *connection, DISCONNECTED, actor).await?;
    }
    Ok(())
}
