//! Email-only intake rules (E1c). The mail reader asks [`relevant`] before it fetches a
//! message's body: only mail in a thread the CRM already holds, or from an address that
//! matches a Client or Contact the mailbox owner may see, may enter the Inbox. Everything else in a
//! member's mailbox is never read past its headers and never stored.
use super::{events, normalize};
use crate::{
    error::ApiResult,
    integrations::webhooks::inbound::{Event, MailRef},
    records::lookup,
    workspaces,
};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

pub async fn relevant(pool: &PgPool, mail: &MailRef<'_>) -> ApiResult<bool> {
    let (workspace, connection, thread, from) =
        (mail.workspace, mail.connection, mail.thread, mail.from);
    let mut tx = pool.begin().await?;
    let known: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM inbox.crm_inbox_conversations \
         WHERE connection_id=$1 AND external_thread_id=$2 AND workspace_id=$3)",
    )
    .bind(connection)
    .bind(thread)
    .bind(workspace)
    .fetch_one(&mut *tx)
    .await?;
    // A new thread needs an authenticated sender who matches a record the mailbox owner
    // may see (review E1c H1, M2); a known thread accepts any sender, flagged if unverified.
    let found = match (known, mail.verified, normalize::email(from)) {
        (true, _, _) => true,
        (false, true, Some(address)) => owner_sees_match(&mut tx, mail, &address).await?,
        _ => false,
    };
    tx.commit().await?;
    Ok(found)
}

async fn owner_sees_match(
    tx: &mut Transaction<'_, Postgres>,
    mail: &MailRef<'_>,
    address: &str,
) -> ApiResult<bool> {
    let Ok(owner) = workspaces::member(tx, mail.workspace, mail.owner).await else {
        return Ok(false);
    };
    for candidate in lookup::contact_matches(tx, mail.workspace, None, Some(address)).await? {
        let ids = [candidate.record_id];
        if !lookup::visible(tx, mail.workspace, &owner, &candidate.collection, &ids)
            .await?
            .is_empty()
        {
            return Ok(true);
        }
    }
    Ok(false)
}

/// A bounce in a known thread fails the latest sent message there; nothing is stored as a
/// client message, and a bounce in an unknown thread is ignored.
pub async fn bounced(tx: &mut Transaction<'_, Postgres>, event: &Event) -> ApiResult<()> {
    let workspace = event.workspace_id.as_str();
    let conversation: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM inbox.crm_inbox_conversations \
         WHERE connection_id=$1 AND external_thread_id=$2 AND workspace_id=$3",
    )
    .bind(event.connection_id)
    .bind(&event.message.thread_id)
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(conversation) = conversation else {
        return Ok(());
    };
    let changed = sqlx::query(
        "UPDATE inbox.crm_inbox_messages SET status='failed',failure_reason='bounced', \
           status_changed_at=now() \
         WHERE id=(SELECT id FROM inbox.crm_inbox_messages WHERE conversation_id=$1 \
           AND direction='outbound' AND status='sent' ORDER BY created_at DESC LIMIT 1)",
    )
    .bind(conversation)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    if changed == 1 {
        events::append(tx, workspace, conversation, None, "send_failed").await?;
    }
    Ok(())
}
