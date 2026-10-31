//! The Inbox's outbox domain (worker side). It marks the message `sending` and commits
//! before the provider call, so a crash leaves it reading as unknown and never re-sent;
//! then it settles the message from the integrations result (design §5).
use super::domain_settle::settle;
use crate::{
    config::{
        google_settings::GoogleConfig, media_settings::MediaConfig,
        messaging_settings::MessagingKey, sendgrid_settings::SendgridConfig,
    },
    error::ApiResult,
    integrations::mail::{self, Email},
    outbox::model::{Domain, Job, Outcome, SendFuture},
};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

pub struct InboxSender {
    pub pool: PgPool,
    pub key: MessagingKey,
    pub google: Option<GoogleConfig>,
    pub sendgrid: SendgridConfig,
    pub media: Option<MediaConfig>,
}

#[derive(FromRow)]
struct Queued {
    conversation_id: Uuid,
    author_user_id: Uuid,
    body: String,
    channel: String,
    connection_id: Uuid,
    external_thread_id: String,
    contact_key: String,
    subject: Option<String>,
    parent: Option<String>,
    replying: bool,
    sendable: bool,
}

const LOAD: &str = "SELECT m.conversation_id,m.author_user_id,m.body,c.channel,c.connection_id, \
    c.external_thread_id,c.contact_key,c.subject, \
    (SELECT i.rfc_message_id FROM inbox.crm_inbox_messages i WHERE i.conversation_id=c.id \
      AND i.direction='inbound' AND i.rfc_message_id IS NOT NULL \
      ORDER BY i.created_at DESC LIMIT 1) AS parent, \
    EXISTS (SELECT 1 FROM inbox.crm_inbox_messages i WHERE i.conversation_id=c.id \
      AND i.direction='inbound') AS replying, \
    (c.state<>'spam' AND NOT EXISTS (SELECT 1 FROM inbox.crm_inbox_blocks b \
      WHERE b.workspace_id=c.workspace_id AND b.channel=c.channel \
        AND b.contact_key=c.contact_key)) AS sendable \
    FROM inbox.crm_inbox_messages m JOIN inbox.crm_inbox_conversations c \
      ON c.id=m.conversation_id \
    WHERE m.id=$1 AND m.workspace_id=$2 AND m.status='queued' FOR UPDATE OF m";

impl Domain for InboxSender {
    fn name(&self) -> &'static str {
        "inbox"
    }

    fn send<'a>(&'a self, job: &'a Job) -> SendFuture<'a> {
        Box::pin(async move {
            match self.deliver(job).await {
                Ok(outcome) => outcome,
                // A database error may come after the provider call; never assume unsent.
                Err(_) => Outcome::Unknown {
                    code: "settle_failed",
                },
            }
        })
    }
}

impl InboxSender {
    async fn deliver(&self, job: &Job) -> ApiResult<Outcome> {
        let queued = match self.prepare(job).await {
            Ok(Ok(queued)) => queued,
            Ok(Err(outcome)) => return Ok(outcome),
            // Nothing reached the provider yet, so trying again is safe (review L1).
            Err(_) => {
                return Ok(Outcome::Retry {
                    after: None,
                    code: "database",
                })
            }
        };
        let finish = |delivery| {
            super::domain_settle::apply(&self.pool, job, queued.conversation_id, delivery)
        };
        let files = match super::domain_files::load(&self.pool, self.media.as_ref(), job).await {
            Ok(files) => files,
            Err(delivery) => return finish(delivery).await,
        };
        let base = queued.subject.as_deref().unwrap_or("Your enquiry");
        let subject = match queued.replying && !base.to_lowercase().starts_with("re:") {
            true => format!("Re: {base}"),
            false => base.to_owned(),
        };
        let thread = Some(queued.external_thread_id.as_str()).filter(|id| !id.starts_with("crm:"));
        let out = mail::Outgoing {
            workspace: &job.workspace_id,
            connection: queued.connection_id,
            author: queued.author_user_id,
            message: job.object_id,
            attachments: &files,
            email: Email {
                to: &queued.contact_key,
                subject: &subject,
                body: &queued.body,
                in_reply_to: queued.parent.as_deref(),
            },
            thread,
        };
        let google = self.google.as_ref();
        let delivery = mail::send(&self.pool, &self.key, google, &self.sendgrid, &out).await?;
        finish(delivery).await
    }

    /// Loads the queued message, refuses what may no longer be sent, and commits `sending`.
    async fn prepare(&self, job: &Job) -> ApiResult<Result<Queued, Outcome>> {
        let mut tx = self.pool.begin().await?;
        let queued: Option<Queued> = sqlx::query_as(LOAD)
            .bind(job.object_id)
            .bind(&job.workspace_id)
            .fetch_optional(&mut *tx)
            .await?;
        let Some(queued) = queued else {
            return Ok(Err(Outcome::Failed { code: "not_queued" }));
        };
        // A block or Spam added after queuing stops the send (review L4).
        let refusal = match (queued.channel.as_str(), queued.sendable) {
            ("email", true) => None,
            ("email", false) => Some("not_sendable"),
            _ => Some("unsupported"),
        };
        if let Some(code) = refusal {
            settle(&mut tx, job, "failed", None, code).await?;
            tx.commit().await?;
            return Ok(Err(Outcome::Failed { code }));
        }
        settle(&mut tx, job, "sending", None, "").await?;
        tx.commit().await?;
        Ok(Ok(queued))
    }
}
