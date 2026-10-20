//! SQL for intake. Every function runs in the caller's transaction, under the workspace
//! lock.
use crate::{error::ApiResult, integrations::webhooks::message::Inbound};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'a, 'b> = &'a mut Transaction<'b, Postgres>;

pub async fn blocked(tx: Tx<'_, '_>, workspace: &str, channel: &str, key: &str) -> ApiResult<bool> {
    sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM inbox.crm_inbox_blocks \
         WHERE workspace_id=$1 AND channel=$2 AND contact_key=$3)",
    )
    .bind(workspace)
    .bind(channel)
    .bind(key)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

/// The conversation for this provider thread, locked for the rest of the transaction.
pub async fn thread(tx: Tx<'_, '_>, connection: Uuid, thread: &str) -> ApiResult<Option<Uuid>> {
    sqlx::query_scalar(
        "SELECT id FROM inbox.crm_inbox_conversations \
         WHERE connection_id=$1 AND external_thread_id=$2 FOR UPDATE",
    )
    .bind(connection)
    .bind(thread)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

pub struct NewConversation<'a> {
    pub id: Uuid,
    pub workspace: &'a str,
    pub channel: &'a str,
    pub connection: Uuid,
    pub thread: &'a str,
    pub key: &'a str,
    pub display: &'a str,
    pub name: Option<&'a str>,
    pub match_state: &'a str,
    pub linked: Option<(&'a str, Uuid)>,
    pub assignee: Option<Uuid>,
    pub state: &'a str,
    pub suggested: bool,
    pub source: Option<&'a str>,
    /// Email only: the subject the client wrote (E1c).
    pub subject: Option<&'a str>,
}

pub async fn open(tx: Tx<'_, '_>, new: &NewConversation<'_>) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO inbox.crm_inbox_conversations (id,workspace_id,channel,connection_id, \
           external_thread_id,contact_key,contact_display,contact_name,match_state, \
           linked_collection,linked_record_id,assignee_id,state,suggested_lead,first_source, \
           subject) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
    )
    .bind(new.id)
    .bind(new.workspace)
    .bind(new.channel)
    .bind(new.connection)
    .bind(new.thread)
    .bind(new.key)
    .bind(new.display)
    .bind(new.name)
    .bind(new.match_state)
    .bind(new.linked.map(|(collection, _)| collection))
    .bind(new.linked.map(|(_, id)| id))
    .bind(new.assignee)
    .bind(new.state)
    .bind(new.suggested)
    .bind(new.source)
    .bind(new.subject)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Stores an inbound message once per provider message ID; `false` for a duplicate.
pub async fn message(
    tx: Tx<'_, '_>,
    conversation: Uuid,
    workspace: &str,
    message: &Inbound,
    sender: Option<(&str, bool)>,
) -> ApiResult<bool> {
    let rfc_message_id = message
        .email
        .as_ref()
        .and_then(|meta| meta.rfc_message_id.as_deref());
    let stored = sqlx::query(
        "INSERT INTO inbox.crm_inbox_messages \
           (id,conversation_id,workspace_id,direction,provider_message_id,status,body,has_media, \
            rfc_message_id,sender,sender_unverified) \
         VALUES ($1,$2,$3,'inbound',$4,'received',$5,$6,$7,$8,$9) \
         ON CONFLICT (conversation_id,provider_message_id) \
           WHERE provider_message_id IS NOT NULL DO NOTHING",
    )
    .bind(Uuid::new_v4())
    .bind(conversation)
    .bind(workspace)
    .bind(&message.message_id)
    .bind(&message.text)
    .bind(message.has_media)
    .bind(rfc_message_id)
    .bind(sender.map(|(address, _)| address))
    .bind(sender.is_some_and(|(_, unverified)| unverified))
    .execute(&mut **tx)
    .await?
    .rows_affected();
    Ok(stored == 1)
}

/// A new inbound message reopens a waiting or resolved conversation (design §4).
pub async fn touch(tx: Tx<'_, '_>, conversation: Uuid) -> ApiResult<()> {
    sqlx::query(
        "UPDATE inbox.crm_inbox_conversations SET last_activity_at=now(),updated_at=now(), \
           version=version+1, \
           state=CASE WHEN state IN ('waiting','resolved') THEN 'open' ELSE state END \
         WHERE id=$1",
    )
    .bind(conversation)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
