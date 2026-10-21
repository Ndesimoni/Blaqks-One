//! Settles a sent message from the integrations result. Accepted: `sent` with Gmail's IDs,
//! and the conversation takes Gmail's thread ID in place of its `crm:` placeholder. A retry
//! before acceptance returns to `queued` until the last attempt. Failures keep their code.
use crate::{
    error::ApiResult,
    inbox::events,
    integrations::mail::Delivery,
    outbox::model::{Job, Outcome, MAX_ATTEMPTS},
};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn apply(
    pool: &PgPool,
    job: &Job,
    conversation: Uuid,
    delivery: Delivery,
) -> ApiResult<Outcome> {
    let mut tx = pool.begin().await?;
    let outcome = match delivery {
        Delivery::Sent {
            id,
            thread_id,
            rfc_id,
        } => {
            settle(&mut tx, job, "sent", Some(&id), "").await?;
            // The CRM's own Message-ID (SendGrid), so replies and bounces can find it (E3c).
            sqlx::query("UPDATE inbox.crm_inbox_messages SET rfc_message_id=$2 WHERE id=$1 AND $2 IS NOT NULL")
                .bind(job.object_id)
                .bind(rfc_id)
                .execute(&mut *tx)
                .await?;
            // Another conversation already holding this thread keeps it; this one keeps
            // its placeholder, and the message is still sent.
            sqlx::query(
                "UPDATE inbox.crm_inbox_conversations c SET external_thread_id=$2 \
                 WHERE c.id=$1 AND c.external_thread_id LIKE 'crm:%' AND NOT EXISTS ( \
                   SELECT 1 FROM inbox.crm_inbox_conversations o \
                   WHERE o.connection_id=c.connection_id AND o.external_thread_id=$2)",
            )
            .bind(conversation)
            .bind(&thread_id)
            .execute(&mut *tx)
            .await?;
            Outcome::Sent
        }
        Delivery::Retry { after, code } if !exhausted(job) => {
            settle(&mut tx, job, "queued", None, "").await?;
            Outcome::Retry { after, code }
        }
        Delivery::Retry { code, .. } | Delivery::Failed { code } => {
            settle(&mut tx, job, "failed", None, code).await?;
            events::append(
                &mut tx,
                &job.workspace_id,
                conversation,
                None,
                "send_failed",
            )
            .await?;
            Outcome::Failed { code }
        }
        Delivery::Unknown { code } => {
            settle(&mut tx, job, "unknown", None, code).await?;
            Outcome::Unknown { code }
        }
    };
    tx.commit().await?;
    Ok(outcome)
}

/// Moves the message to `status`; `code` is stored as the failure reason when not empty.
pub async fn settle(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    job: &Job,
    status: &str,
    provider_id: Option<&str>,
    code: &str,
) -> ApiResult<()> {
    sqlx::query(
        "UPDATE inbox.crm_inbox_messages SET status=$3,status_changed_at=now(), \
           provider_message_id=COALESCE($4,provider_message_id),failure_reason=NULLIF($5,'') \
         WHERE id=$1 AND workspace_id=$2",
    )
    .bind(job.object_id)
    .bind(&job.workspace_id)
    .bind(status)
    .bind(provider_id)
    .bind(code)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub fn exhausted(job: &Job) -> bool {
    job.attempts >= MAX_ATTEMPTS
}
