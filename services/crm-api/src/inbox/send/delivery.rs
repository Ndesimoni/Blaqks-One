//! Provider delivery events for sent email (E3b, design §5–§6), called by `integrations`
//! once an event is verified. An event changes only an outbound message of a conversation
//! on the same connection, and only forward: Delivered from sending, sent or unknown (a
//! signed event resolves an unknown outcome); Failed from those or Delivered, since a
//! bounce can follow acceptance. Applying an event twice changes nothing more.
use super::super::events;
use crate::error::ApiResult;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Kind {
    Delivered,
    Bounced,
    Dropped,
}

pub struct Update<'a> {
    pub message: Uuid,
    pub kind: Kind,
    pub provider_id: Option<&'a str>,
}

pub async fn apply(
    pool: &PgPool,
    workspace: &str,
    connection: Uuid,
    updates: &[Update<'_>],
) -> ApiResult<()> {
    let mut tx = pool.begin().await?;
    for update in updates {
        let (status, from, reason): (&str, &[&str], Option<&str>) = match update.kind {
            Kind::Delivered => ("delivered", &["sending", "sent", "unknown"], None),
            Kind::Bounced => (
                "failed",
                &["sending", "sent", "unknown", "delivered"],
                Some("bounced"),
            ),
            Kind::Dropped => (
                "failed",
                &["sending", "sent", "unknown", "delivered"],
                Some("dropped"),
            ),
        };
        let from: Vec<String> = from.iter().map(|value| value.to_string()).collect();
        // SendGrid's event ID starts with the X-Message-Id it returned (review L4).
        let changed: Option<Uuid> = sqlx::query_scalar(
            "UPDATE inbox.crm_inbox_messages m SET status=$4,status_changed_at=now(),
               failure_reason=COALESCE($5,m.failure_reason)
             FROM inbox.crm_inbox_conversations c
             WHERE m.id=$1 AND m.workspace_id=$2 AND c.id=m.conversation_id
               AND c.workspace_id=$2 AND c.connection_id=$3 AND m.direction='outbound'
               AND m.status=ANY($6)
               AND ($7::text IS NULL OR m.provider_message_id IS NULL
                    OR starts_with($7, m.provider_message_id))
             RETURNING m.conversation_id",
        )
        .bind(update.message)
        .bind(workspace)
        .bind(connection)
        .bind(status)
        .bind(reason)
        .bind(&from)
        .bind(update.provider_id)
        .fetch_optional(&mut *tx)
        .await?;
        if let (Some(conversation), "failed") = (changed, status) {
            events::append(&mut tx, workspace, conversation, None, "send_failed").await?;
        }
    }
    tx.commit().await?;
    Ok(())
}
