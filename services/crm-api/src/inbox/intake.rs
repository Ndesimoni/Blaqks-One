//! Verified inbound messages into conversations (design §4 and §6): blocked senders are
//! dropped, known threads gain the message once, and a new thread is matched against
//! Clients and Contacts through the records module, run through the lead rules and
//! routed: listing agent, then the matched record's holder, else Unassigned.
use super::{
    events,
    intake_company::Thread,
    intake_store as store, matching,
    normalize::{self, Contact},
    rules::Decision,
};
use crate::{
    error::{ApiError, ApiResult},
    integrations::webhooks::inbound::{
        Event, MailRef, RelevantFuture, Sink, SinkError, SinkFuture,
    },
    workspaces,
};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

/// The Inbox as the messaging worker's inbound sink.
pub struct InboxSink {
    pub pool: PgPool,
}

impl Sink for InboxSink {
    fn accept<'a>(&'a self, event: &'a Event) -> SinkFuture<'a> {
        Box::pin(receive(&self.pool, event))
    }

    fn email_relevant<'a>(&'a self, mail: &'a MailRef<'a>) -> RelevantFuture<'a> {
        Box::pin(async move {
            super::intake_email::relevant(&self.pool, mail)
                .await
                .map_err(|_| SinkError::Retry)
        })
    }
}

/// Stores one event. Idempotent: a replayed provider message adds nothing.
pub async fn receive(pool: &PgPool, event: &Event) -> Result<(), SinkError> {
    let contact = normalize::contact(&event.channel, &event.message.from)
        .ok_or(SinkError::Permanent("invalid_sender"))?;
    store_event(pool, event, &contact)
        .await
        .map_err(|ApiError(status, ..)| {
            // A refusal (archived team, invalid record) can never succeed on retry (X3-S6).
            if status.is_client_error() {
                SinkError::Permanent("intake_refused")
            } else {
                SinkError::Retry
            }
        })
}

async fn store_event(pool: &PgPool, event: &Event, contact: &Contact) -> ApiResult<()> {
    let workspace = event.workspace_id.as_str();
    let mut tx = pool.begin().await?;
    workspaces::lock(&mut tx, workspace).await?;
    if store::blocked(&mut tx, workspace, &event.channel, &contact.key).await? {
        tx.commit().await?;
        return Ok(());
    }
    let message = &event.message;
    let email = message.email.as_ref();
    if email.is_some_and(|meta| meta.bounce) {
        // A delivery failure notice is never a client message (E1c).
        super::intake_email::bounced(&mut tx, event).await?;
        tx.commit().await?;
        return Ok(());
    }
    let conversation = match super::intake_company::thread(&mut tx, event).await? {
        Thread::Known(id) => id,
        Thread::New => open(&mut tx, event, contact).await?,
        Thread::Drop => {
            tx.commit().await?;
            return Ok(());
        }
    };
    let stored = store::message(
        &mut tx,
        conversation,
        workspace,
        message,
        // Who actually wrote it, and whether Gmail vouched for them (review E1c M1, M2).
        email.map(|meta| (contact.key.as_str(), !meta.verified)),
    )
    .await?;
    if stored {
        store::touch(&mut tx, conversation).await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Opens the conversation for a new thread and returns its ID.
async fn open(
    tx: &mut Transaction<'_, Postgres>,
    event: &Event,
    contact: &Contact,
) -> ApiResult<Uuid> {
    let workspace = event.workspace_id.as_str();
    let message = &event.message;
    let found = matching::resolve(tx, event, contact).await?;
    let (match_state, linked, decision) = (found.match_state, found.linked, found.decision);
    let id = Uuid::new_v4();
    let holder = linked.as_ref().and_then(|(_, _, assignee)| *assignee);
    let new = store::NewConversation {
        id,
        workspace,
        channel: &event.channel,
        connection: event.connection_id,
        thread: &message.thread_id,
        key: &contact.key,
        display: &contact.display,
        name: message.name.as_deref(),
        match_state,
        linked: linked
            .as_ref()
            .map(|(collection, record, _)| (collection.as_str(), *record)),
        // A mailbox's mail stays with its owner, never the record's holder (E1c H1).
        assignee: super::intake_company::live_owner(tx, event)
            .await?
            .or(found.listing_agent.or(holder)),
        state: if linked.is_some() { "open" } else { "new" },
        suggested: decision == Decision::Suggest,
        source: message.source.map(|source| source.as_str()),
        subject: message
            .email
            .as_ref()
            .and_then(|meta| meta.subject.as_deref()),
    };
    store::open(tx, &new).await?;
    events::append(tx, workspace, id, None, "created").await?;
    let follow_up = match (decision, linked.is_some()) {
        (Decision::Create, _) => Some("lead_created"),
        (Decision::Suggest, _) => Some("lead_suggested"),
        (_, true) => Some("matched"),
        _ => None,
    };
    if let Some(action) = follow_up {
        events::append(tx, workspace, id, None, action).await?;
    }
    Ok(id)
}
