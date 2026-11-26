//! WhatsApp sending from the Inbox (packet W1b, design §5 and §18). Only the member the
//! number is given to, live, with the grant, sends, and only in a thread on their active
//! number. Spam, blocked and opted-out clients are refused; free text needs the 24-hour
//! window and a template needs agreement. Each send queues one message and its outbox job
//! in the caller's transaction, under the workspace lock.
use super::{
    conflict,
    whatsapp_queue::{prepare, queue},
    whatsapp_rules as rules,
};
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
    integrations::whatsapp::{self, Number},
};
use serde_json::Value;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'a, 'b> = &'a mut Transaction<'b, Postgres>;

pub const ATTACHMENTS: &str = "Attachments are not available on WhatsApp yet.";

/// What a member asked to send.
pub enum Content {
    Text(String),
    Template(String, Vec<String>),
}

#[derive(FromRow)]
pub struct Thread {
    pub channel: String,
    pub connection_id: Uuid,
    pub contact_key: String,
    pub whatsapp_number_id: Option<Uuid>,
    pub state: String,
    pub blocked: bool,
    pub last_inbound: Option<i64>,
    pub now: i64,
}

/// A conversation's WhatsApp sending details and the database clock.
pub async fn thread(tx: Tx<'_, '_>, id: Uuid) -> ApiResult<Thread> {
    sqlx::query_as(
        "SELECT c.channel,c.connection_id,c.contact_key,c.whatsapp_number_id,c.state, \
           EXISTS (SELECT 1 FROM inbox.crm_inbox_blocks b WHERE b.workspace_id=c.workspace_id \
             AND b.channel=c.channel AND b.contact_key=c.contact_key) AS blocked, \
           extract(epoch FROM c.last_inbound_at)::bigint AS last_inbound, \
           extract(epoch FROM now())::bigint AS now \
         FROM inbox.crm_inbox_conversations c WHERE c.id=$1",
    )
    .bind(id)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

/// The caller's own active number on a connected company account.
pub async fn sender(tx: Tx<'_, '_>, workspace: &str, user: &UserRow) -> ApiResult<Number> {
    if user.role != "admin" && !user.channel_access.0.whatsapp {
        return Err(ApiError::forbidden());
    }
    let number = whatsapp::own_number(tx, workspace, user.id)
        .await?
        .ok_or(conflict(
            "Ask your Admin for a WhatsApp number before sending.",
            "number_required",
        ))?;
    if !number.account_connected {
        return Err(conflict(
            "Reconnect the company's Twilio account before sending on WhatsApp.",
            "account_reconnect",
        ));
    }
    Ok(number)
}

/// Replies go only from the thread's own number, which must be the caller's (as O9).
pub async fn same_number(
    tx: Tx<'_, '_>,
    workspace: &str,
    thread: &Thread,
    number: &Number,
) -> ApiResult<()> {
    if thread.whatsapp_number_id != Some(number.id) {
        let held = match thread.whatsapp_number_id {
            Some(id) => whatsapp::number(tx, workspace, id).await?,
            None => None,
        };
        if held.is_some_and(|held| held.member_id == number.member_id) {
            return Err(conflict(
                "This conversation's WhatsApp number is disconnected. Start a new conversation instead.",
                "number_disconnected",
            ));
        }
        return Err(conflict(
            "This conversation is on a colleague's WhatsApp number. Start your own conversation instead.",
            "other_number",
        ));
    }
    if thread.state == "spam" || thread.blocked {
        return Err(conflict(
            "This sender is blocked or marked as spam.",
            "not_sendable",
        ));
    }
    Ok(())
}

/// Reply or Send again in a visible WhatsApp conversation.
pub async fn send(
    tx: Tx<'_, '_>,
    workspace: &str,
    user: &UserRow,
    id: Uuid,
    content: Content,
    repeat_of: Option<Uuid>,
) -> ApiResult<Value> {
    let number = sender(tx, workspace, user).await?;
    let thread = thread(tx, id).await?;
    same_number(tx, workspace, &thread, &number).await?;
    let window = rules::window(thread.last_inbound, thread.now);
    let key = &thread.contact_key;
    let prepared = prepare(tx, workspace, number.connection_id, key, window, content).await?;
    queue(tx, workspace, id, user.id, prepared, repeat_of).await
}
