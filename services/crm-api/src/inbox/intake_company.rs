//! Company mail on a SendGrid domain (E3c, docs/sendgrid-design.md §12): which
//! conversation an incoming mail joins, whether a new thread may open (a verified sender
//! within the daily budgets), and the member it belongs to, re-checked under the lock.
use super::normalize;
use crate::{
    error::ApiResult, integrations::webhooks::inbound::Event, records::lookup, workspaces,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub enum Thread {
    Known(Uuid),
    New,
    Drop,
}

/// The event's conversation. Company mail on a SendGrid domain (E3c) also joins the
/// conversation whose Message-IDs it answers; a new company thread needs a verified,
/// unspammy sender, otherwise the mail is dropped (design §6, review M1).
pub async fn thread(tx: &mut Transaction<'_, Postgres>, event: &Event) -> ApiResult<Thread> {
    let connection = event.connection_id;
    if let Some(id) = super::intake_store::thread(tx, connection, &event.message.thread_id).await? {
        return Ok(Thread::Known(id));
    }
    let Some(meta) = event.message.email.as_ref().filter(|meta| meta.company) else {
        return Ok(Thread::New);
    };
    let answered = answered(tx, event, &meta.references).await?;
    if let Some(id) = answered {
        return Ok(Thread::Known(id));
    }
    let open = meta.verified && within_budget(tx, event).await?;
    Ok(if open { Thread::New } else { Thread::Drop })
}

/// The conversation on this connection whose thread or any message has one of these
/// Message-IDs, locked; no query at all without references (review M3).
async fn answered(
    tx: &mut Transaction<'_, Postgres>,
    event: &Event,
    references: &[String],
) -> ApiResult<Option<Uuid>> {
    if references.is_empty() {
        return Ok(None);
    }
    let found: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM (SELECT c.id,c.last_activity_at FROM inbox.crm_inbox_conversations c \
           WHERE c.connection_id=$1 AND c.workspace_id=$2 AND c.external_thread_id=ANY($3) \
         UNION ALL SELECT c.id,c.last_activity_at FROM inbox.crm_inbox_messages m \
           JOIN inbox.crm_inbox_conversations c ON c.id=m.conversation_id \
           WHERE m.rfc_message_id=ANY($3) AND c.connection_id=$1 AND c.workspace_id=$2) t \
         ORDER BY last_activity_at DESC LIMIT 1",
    )
    .bind(event.connection_id)
    .bind(&event.workspace_id)
    .bind(references)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(id) = found else {
        return Ok(None);
    };
    sqlx::query_scalar("SELECT id FROM inbox.crm_inbox_conversations WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(Into::into)
}

/// The member a company mail names, only while they are still live with the email grant,
/// checked under the intake's workspace lock (review L1). Other mail keeps its owner.
pub async fn live_owner(
    tx: &mut Transaction<'_, Postgres>,
    event: &Event,
) -> ApiResult<Option<Uuid>> {
    let Some(meta) = event.message.email.as_ref() else {
        return Ok(None);
    };
    let Some(owner) = meta.owner.filter(|_| meta.company) else {
        return Ok(meta.owner);
    };
    let live = workspaces::member(tx, &event.workspace_id, owner).await;
    let allowed =
        live.is_ok_and(|user| crate::integrations::mailbox_allowed(&user, &event.workspace_id));
    Ok(allowed.then_some(owner))
}

/// New company threads a day: 10 per sender, 25 per sender domain and 500 per connection,
/// so a flood from signed domains cannot fill the Inbox or crowd out real mail. A sender
/// who matches a Client or Contact is never held back (review L3, E3c review M2).
async fn within_budget(tx: &mut Transaction<'_, Postgres>, event: &Event) -> ApiResult<bool> {
    let sender = normalize::email(&event.message.from).unwrap_or_default();
    let known = lookup::contact_matches(tx, &event.workspace_id, None, Some(&sender)).await?;
    if !known.is_empty() {
        return Ok(true);
    }
    let domain = sender.rsplit('@').next().unwrap_or_default().to_owned();
    let (per_sender, per_domain, per_connection): (i64, i64, i64) = sqlx::query_as(
        "SELECT count(*) FILTER (WHERE contact_key=$2), \
           count(*) FILTER (WHERE split_part(contact_key,'@',2)=$3), count(*) \
         FROM inbox.crm_inbox_conversations \
         WHERE connection_id=$1 AND created_at > now() - interval '1 day'",
    )
    .bind(event.connection_id)
    .bind(&sender)
    .bind(&domain)
    .fetch_one(&mut **tx)
    .await?;
    Ok(per_sender < 10 && per_domain < 25 && per_connection < 500)
}
