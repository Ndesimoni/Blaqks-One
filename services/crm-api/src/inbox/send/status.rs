//! WhatsApp status callbacks for sent messages (W1b, design §5, W-M2), called by
//! `integrations` inside its own transaction once a callback is verified. A message is
//! found only joined to its WhatsApp conversation on that connection and company, and its
//! status moves forward only: sent from sending or unknown; delivered from those or sent;
//! read from those or delivered; failed from sending, sent or unknown. A signed callback
//! may resolve `unknown`, because it proves what Twilio did.
use super::super::events;
use crate::error::ApiResult;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'a, 'b> = &'a mut Transaction<'b, Postgres>;

#[derive(FromRow)]
pub struct Target {
    pub conversation: Uuid,
    pub number: Option<Uuid>,
    pub contact_key: String,
    pub provider_id: Option<String>,
}

pub struct Change<'a> {
    pub message: Uuid,
    pub status: &'a str,
    pub reason: Option<&'a str>,
    pub sid: &'a str,
}

/// The outbound message `message` of a WhatsApp thread on `connection`, locked.
pub async fn target(
    tx: Tx<'_, '_>,
    workspace: &str,
    connection: Uuid,
    message: Uuid,
) -> ApiResult<Option<Target>> {
    sqlx::query_as(
        "SELECT c.id AS conversation,c.whatsapp_number_id AS number,c.contact_key, \
           m.provider_message_id AS provider_id \
         FROM inbox.crm_inbox_messages m JOIN inbox.crm_inbox_conversations c \
           ON c.id=m.conversation_id \
         WHERE m.id=$1 AND m.workspace_id=$2 AND c.workspace_id=$2 AND c.connection_id=$3 \
           AND c.channel='whatsapp' AND m.direction='outbound' FOR UPDATE OF m",
    )
    .bind(message)
    .bind(workspace)
    .bind(connection)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

/// Whether another message of this connection already holds `sid`.
pub async fn sid_taken(
    tx: Tx<'_, '_>,
    workspace: &str,
    connection: Uuid,
    message: Uuid,
    sid: &str,
) -> ApiResult<bool> {
    sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM inbox.crm_inbox_messages m \
           JOIN inbox.crm_inbox_conversations c ON c.id=m.conversation_id \
           WHERE c.workspace_id=$1 AND c.connection_id=$2 AND m.id<>$3 \
             AND m.provider_message_id=$4)",
    )
    .bind(workspace)
    .bind(connection)
    .bind(message)
    .bind(sid)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

/// The statuses each callback status may move a message from.
pub fn moves_from(status: &str) -> &'static [&'static str] {
    match status {
        "sent" => &["sending", "unknown"],
        "delivered" => &["sending", "unknown", "sent"],
        "read" => &["sending", "unknown", "sent", "delivered"],
        "failed" => &["sending", "unknown", "sent"],
        _ => &[],
    }
}

/// Applies the change once; `false` when it would not move the message forward.
pub async fn apply(tx: Tx<'_, '_>, workspace: &str, change: &Change<'_>) -> ApiResult<bool> {
    let from: Vec<&str> = moves_from(change.status).to_vec();
    let changed: Option<Uuid> = sqlx::query_scalar(
        "UPDATE inbox.crm_inbox_messages SET status=$3,status_changed_at=now(), \
           failure_reason=CASE WHEN $3='failed' THEN $4 ELSE failure_reason END, \
           provider_message_id=COALESCE(provider_message_id,$5) \
         WHERE id=$1 AND workspace_id=$2 AND status=ANY($6) \
           AND (provider_message_id IS NULL OR provider_message_id=$5) \
         RETURNING conversation_id",
    )
    .bind(change.message)
    .bind(workspace)
    .bind(change.status)
    .bind(change.reason)
    .bind(change.sid)
    .bind(&from)
    .fetch_optional(&mut **tx)
    .await?;
    if let (Some(conversation), "failed") = (changed, change.status) {
        events::append(tx, workspace, conversation, None, "send_failed").await?;
    }
    Ok(changed.is_some())
}

#[cfg(test)]
mod tests {
    use super::moves_from;

    #[test]
    fn statuses_only_move_forward() {
        let order = ["sending", "sent", "delivered", "read"];
        for (later, status) in order.iter().enumerate().skip(1) {
            for earlier in &order[..later] {
                assert!(
                    moves_from(status).contains(earlier),
                    "{earlier} -> {status}"
                );
            }
            for same_or_later in &order[later..] {
                assert!(!moves_from(status).contains(same_or_later), "{status}");
            }
            assert!(moves_from(status).contains(&"unknown"), "{status}");
        }
        assert!(!moves_from("failed").contains(&"delivered"));
        assert!(!moves_from("failed").contains(&"read"));
        for status in ["sent", "delivered", "read", "failed"] {
            for never in ["queued", "failed", "received", "draft"] {
                assert!(!moves_from(status).contains(&never), "{never} -> {status}");
            }
        }
        assert!(moves_from("queued").is_empty());
    }
}
