//! The mailbox's Gmail cursor, and marking it for its owner to sign in again (E1c).
use super::Sync;
use crate::{
    error::ApiResult,
    integrations::{google::history, model::ConnectionRow, store_write},
};
use uuid::Uuid;

impl Sync {
    /// Starts the cursor at the mailbox's present: only mail from now on is read.
    pub(super) async fn restart(&self, id: Uuid, access: &str) -> ApiResult<()> {
        match history::current(&self.google, access).await {
            Ok(cursor) => self.save(id, &cursor).await,
            Err(_) => Ok(()),
        }
    }

    pub(super) async fn save(&self, id: Uuid, cursor: &str) -> ApiResult<()> {
        if !cursor.bytes().all(|byte| byte.is_ascii_digit()) || cursor.len() > 30 {
            return Ok(());
        }
        sqlx::query(
            "UPDATE integrations.crm_channel_connections \
             SET mail_history_id=$2,mail_synced_at=now() WHERE id=$1 AND state='connected'",
        )
        .bind(id)
        .bind(cursor)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub(super) async fn reconnect(&self, row: &ConnectionRow) -> ApiResult<()> {
        let mut tx = self.pool.begin().await?;
        if store_write::set_reconnect_required(&mut tx, &row.workspace_id, row.id).await? {
            let owner = row.owner_member_id.unwrap_or(row.id);
            store_write::event(
                &mut tx,
                &row.workspace_id,
                row.id,
                "reconnect_required",
                owner,
            )
            .await?;
        }
        tx.commit().await?;
        Ok(())
    }
}
