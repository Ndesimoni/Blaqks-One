//! Verified inbound messages into conversations (design §4 and §6): blocked senders are
//! dropped, known threads gain the message once, and a new thread is matched against
//! Clients and Contacts through the records module, run through the lead rules and
//! routed: listing agent, then the matched record's holder, else Unassigned.
use super::{
    intake_company::Thread,
    intake_files::{self, Incoming},
    intake_open::open,
    intake_store as store,
    normalize::{self, Contact},
};
use crate::{
    error::{ApiError, ApiResult},
    integrations::webhooks::inbound::{
        Event, MailRef, RelevantFuture, Sink, SinkError, SinkFuture,
    },
    media::inbound::Reserved,
    workspaces,
};
use sqlx::PgPool;

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
    receive_mail(pool, event, Incoming::default())
        .await
        .map(|_| ())
}

/// Stores one event with the files of an incoming email (F3b), reserving those that may be
/// kept; the caller stores their bytes after this commit.
pub async fn receive_mail(
    pool: &PgPool,
    event: &Event,
    incoming: Incoming,
) -> Result<Vec<Reserved>, SinkError> {
    let contact = normalize::contact(&event.channel, &event.message.from)
        .ok_or(SinkError::Permanent("invalid_sender"))?;
    store_event(pool, event, &contact, incoming)
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

async fn store_event(
    pool: &PgPool,
    event: &Event,
    contact: &Contact,
    incoming: Incoming,
) -> ApiResult<Vec<Reserved>> {
    let workspace = event.workspace_id.as_str();
    let mut tx = pool.begin().await?;
    workspaces::lock(&mut tx, workspace).await?;
    if store::blocked(&mut tx, workspace, &event.channel, &contact.key).await? {
        tx.commit().await?;
        return Ok(Vec::new());
    }
    let message = &event.message;
    let email = message.email.as_ref();
    if email.is_some_and(|meta| meta.bounce) {
        // A delivery failure notice is never a client message (E1c).
        super::intake_email::bounced(&mut tx, event).await?;
        tx.commit().await?;
        return Ok(Vec::new());
    }
    let conversation = match super::intake_company::thread(&mut tx, event).await? {
        Thread::Known(id) => id,
        Thread::New => open(&mut tx, event, contact).await?,
        Thread::Drop => {
            tx.commit().await?;
            return Ok(Vec::new());
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
    let mut reserved = Vec::new();
    if let Some(id) = stored {
        store::touch(&mut tx, conversation).await?;
        reserved = intake_files::keep(&mut tx, event, id, incoming).await?;
    }
    tx.commit().await?;
    Ok(reserved)
}
