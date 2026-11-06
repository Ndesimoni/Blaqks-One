//! The Inbox's outbox domain (worker side). Each job sends one queued message on its
//! conversation's channel: email (`domain_email.rs`) or WhatsApp (`domain_whatsapp.rs`).
//! Both mark the message `sending` and commit before the provider call, so a crash leaves
//! it reading as unknown and never re-sent (design §5).
use crate::{
    config::{
        google_settings::GoogleConfig, media_settings::MediaConfig,
        messaging_settings::MessagingKey, sendgrid_settings::SendgridConfig,
        twilio_settings::TwilioConfig,
    },
    error::ApiResult,
    outbox::model::{Domain, Job, Outcome, SendFuture},
};
use sqlx::PgPool;

pub struct InboxSender {
    pub pool: PgPool,
    pub key: MessagingKey,
    pub google: Option<GoogleConfig>,
    pub sendgrid: SendgridConfig,
    pub twilio: TwilioConfig,
    pub media: Option<MediaConfig>,
}

impl Domain for InboxSender {
    fn name(&self) -> &'static str {
        "inbox"
    }

    fn send<'a>(&'a self, job: &'a Job) -> SendFuture<'a> {
        Box::pin(async move {
            match self.route(job).await {
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
    async fn route(&self, job: &Job) -> ApiResult<Outcome> {
        let channel: Result<Option<String>, _> = sqlx::query_scalar(
            "SELECT c.channel FROM inbox.crm_inbox_messages m \
             JOIN inbox.crm_inbox_conversations c ON c.id=m.conversation_id \
             WHERE m.id=$1 AND m.workspace_id=$2",
        )
        .bind(job.object_id)
        .bind(&job.workspace_id)
        .fetch_optional(&self.pool)
        .await;
        match channel {
            Ok(Some(channel)) if channel == "whatsapp" => {
                super::domain_whatsapp::deliver(self, job).await
            }
            Ok(_) => super::domain_email::deliver(self, job).await,
            // Nothing reached the provider yet, so trying again is safe (review L1).
            Err(_) => Ok(Outcome::Retry {
                after: None,
                code: "database",
            }),
        }
    }
}
