//! Client replies from connected Google mailboxes (E1c). The messaging worker reads each
//! mailbox's Gmail history since its cursor; a new mailbox starts from now, so no older
//! mail is read. A refused token marks the mailbox for its owner to sign in again.
mod cursor;
mod event;

use super::{credential, google, store, webhooks::inbound::Sink};
use crate::{
    config::{google_settings::GoogleConfig, messaging_settings::MessagingKey},
    error::ApiResult,
};
use event::{import, Mailbox, Outcome};
use google::{history, oauth::Failure};
use sqlx::PgPool;
use std::{sync::Arc, time::Duration};
use uuid::Uuid;

pub struct Sync {
    pub pool: PgPool,
    pub key: MessagingKey,
    pub google: GoogleConfig,
    pub sink: Arc<dyn Sink>,
}

impl Sync {
    /// One round over the connected Google mailboxes, least recently synced first.
    pub async fn round(&self) -> ApiResult<()> {
        let due: Vec<(String, Uuid)> = sqlx::query_as(
            "SELECT workspace_id,id FROM integrations.crm_channel_connections \
             WHERE channel='email' AND provider='google' AND state='connected' \
             ORDER BY mail_synced_at NULLS FIRST LIMIT 50",
        )
        .fetch_all(&self.pool)
        .await?;
        for (workspace, id) in due {
            if self.mailbox(&workspace, id).await.is_err() {
                eprintln!("CRM mailbox sync failed for one mailbox.");
            }
        }
        Ok(())
    }

    async fn mailbox(&self, workspace: &str, id: Uuid) -> ApiResult<()> {
        let mut tx = self.pool.begin().await?;
        let Some(row) = store::load(&mut tx, workspace, id).await? else {
            return Ok(());
        };
        // A frozen team or a member who lost the email grant syncs nothing (review E1c L3).
        let Some(owner) = row.owner_member_id else {
            return Ok(());
        };
        let live = crate::workspaces::member(&mut tx, workspace, owner).await;
        if !live.is_ok_and(|user| super::mailbox::may_connect(&user, workspace)) {
            return Ok(());
        }
        let cursor: Option<String> = sqlx::query_scalar(
            "SELECT mail_history_id FROM integrations.crm_channel_connections WHERE id=$1",
        )
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
        let token = credential::open(&mut tx, &self.key, &row).await?;
        tx.commit().await?;
        let Some(token) = token else { return Ok(()) };
        let access = match google::refresh::refresh(&self.google, &token).await {
            Ok(access) => access,
            Err(Failure::Refused) => return self.reconnect(&row).await,
            Err(Failure::Unavailable | Failure::Invalid) => return Ok(()),
        };
        let Some(cursor) = cursor else {
            return self.restart(id, &access).await;
        };
        let (ids, next) = match history::changes(&self.google, &access, &cursor).await {
            Ok(history::Changes::Added { ids, cursor }) => (ids, cursor),
            Ok(history::Changes::Expired) => return self.restart(id, &access).await,
            Err(_) => return Ok(()),
        };
        let mail = Mailbox {
            workspace,
            connection: id,
            owner,
            address: &row.external_account_id,
            token: &access,
        };
        for message in &ids {
            if let Outcome::Later = import(&self.google, self.sink.as_ref(), &mail, message).await {
                // Keep the cursor; the Inbox stores each provider message once.
                return Ok(());
            }
        }
        self.save(id, &next).await
    }
}

/// The worker loop: one round every `every` until shutdown.
pub fn spawn(
    sync: Sync,
    every: Duration,
    mut shutdown: tokio::sync::watch::Receiver<bool>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            if sync.round().await.is_err() {
                eprintln!("CRM mailbox sync round failed.");
            }
            if crate::outbox::worker::pause(&mut shutdown, every).await {
                break;
            }
        }
    })
}
