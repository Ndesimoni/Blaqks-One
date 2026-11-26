//! Archiving an Admin freezes the whole company for good, so its channel connections end
//! with it (owner decision 2026-10-21, SendGrid code review L2). Every live connection is
//! disconnected in the archive's own transaction: the sealed credential is deleted, intake
//! stops, and the domain, number or Page is released for a fresh connection. Conversations,
//! messages and connection history stay for the Super Admin's read-only views.
use super::model::ConnectionRow;
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Called by `team` under the archive's workspace lock (service boundaries).
pub async fn archived(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
) -> ApiResult<()> {
    let ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM integrations.crm_channel_connections
         WHERE workspace_id=$1 AND state<>'disconnected' ORDER BY id FOR UPDATE",
    )
    .bind(workspace)
    .fetch_all(&mut **tx)
    .await?;
    for id in ids {
        let row: Option<ConnectionRow> = super::store::load(tx, workspace, id).await?;
        if let Some(row) = row {
            super::revocation::disconnect(tx, &row, actor).await?;
        }
    }
    Ok(())
}
