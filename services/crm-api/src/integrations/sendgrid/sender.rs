//! Which connection a member sends through when the company uses SendGrid (E3b). Every
//! member with an active address on the company domain sends through the one company
//! connection, so they may reply in any conversation they can see; From is still always
//! their own address, set by the worker.
use crate::{error::ApiResult, integrations::addresses::lookup};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// `None` when the company does not use SendGrid; `Some(None)` when it does but this
/// member cannot send yet (no active address, or the connection needs attention).
pub async fn company_sender(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    member: Uuid,
) -> ApiResult<Option<Option<Uuid>>> {
    let live: Option<(Uuid, String, String)> = sqlx::query_as(
        "SELECT id,external_account_id,state FROM integrations.crm_channel_connections
         WHERE workspace_id=$1 AND provider='sendgrid' AND state<>'disconnected'",
    )
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((id, domain, state)) = live else {
        return Ok(None);
    };
    if state != "connected" {
        return Ok(Some(None));
    }
    let address = lookup::active(tx, workspace, &domain, member).await?;
    Ok(Some(address.map(|_| id)))
}
