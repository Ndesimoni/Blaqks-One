//! WhatsApp delivery for the Inbox's outbox domain (W1b, design §5). Under the message
//! lock it re-checks what the Inbox owns: Spam or blocked, the client's consent (`opt_out`
//! refuses; a template needs `opt_in`) and, for free text, the 24-hour window. It marks the
//! message `sending` and commits; `integrations` re-checks the number, member, account and
//! template and calls Twilio. A callback that arrived meanwhile keeps its status.
use super::{
    domain::InboxSender,
    domain_settle::{exhausted, settle},
    whatsapp_rules as rules,
};
use crate::{
    error::ApiResult,
    inbox::{consent, events},
    integrations::whatsapp::{self, Content, Outgoing, Sent},
    outbox::model::{Job, Outcome},
};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow)]
struct Queued {
    conversation_id: Uuid,
    author_user_id: Uuid,
    body: String,
    template_sid: Option<String>,
    template_variables: Option<Vec<String>>,
    connection_id: Uuid,
    contact_key: String,
    whatsapp_number_id: Option<Uuid>,
    sendable: bool,
    last_inbound: Option<i64>,
    now: i64,
}

const LOAD: &str = "SELECT m.conversation_id,m.author_user_id,m.body,m.template_sid, \
    m.template_variables,c.connection_id,c.contact_key,c.whatsapp_number_id, \
    (c.state<>'spam' AND NOT EXISTS (SELECT 1 FROM inbox.crm_inbox_blocks b \
      WHERE b.workspace_id=c.workspace_id AND b.channel=c.channel \
        AND b.contact_key=c.contact_key)) AS sendable, \
    extract(epoch FROM c.last_inbound_at)::bigint AS last_inbound, \
    extract(epoch FROM now())::bigint AS now \
    FROM inbox.crm_inbox_messages m JOIN inbox.crm_inbox_conversations c \
      ON c.id=m.conversation_id \
    WHERE m.id=$1 AND m.workspace_id=$2 AND m.status='queued' AND c.channel='whatsapp' \
    FOR UPDATE OF m";

pub async fn deliver(sender: &InboxSender, job: &Job) -> ApiResult<Outcome> {
    let (queued, number) = match prepare(sender, job).await {
        Ok(Ok(ready)) => ready,
        Ok(Err(outcome)) => return Ok(outcome),
        // Nothing reached Twilio yet, so trying again is safe.
        Err(_) => {
            return Ok(Outcome::Retry {
                after: None,
                code: "database",
            })
        }
    };
    let content = match (&queued.template_sid, &queued.template_variables) {
        (Some(sid), Some(variables)) => Content::Template { sid, variables },
        _ => Content::Text(&queued.body),
    };
    let out = Outgoing {
        workspace: &job.workspace_id,
        connection: queued.connection_id,
        number,
        author: queued.author_user_id,
        message: job.object_id,
        to: &queued.contact_key,
        content,
    };
    let sent = whatsapp::send(&sender.pool, &sender.key, &sender.twilio, &out).await?;
    finish(sender, job, queued.conversation_id, sent).await
}

/// Loads the queued message, refuses what may no longer be sent, and commits `sending`.
async fn prepare(sender: &InboxSender, job: &Job) -> ApiResult<Result<(Queued, Uuid), Outcome>> {
    let mut tx = sender.pool.begin().await?;
    // After any consent, block or Spam change in progress commits (design §18).
    crate::workspaces::lock(&mut tx, &job.workspace_id).await?;
    let queued: Option<Queued> = sqlx::query_as(LOAD)
        .bind(job.object_id)
        .bind(&job.workspace_id)
        .fetch_optional(&mut *tx)
        .await?;
    let Some(queued) = queued else {
        return Ok(Err(Outcome::Failed { code: "not_queued" }));
    };
    let current = consent::latest(&mut tx, &job.workspace_id, &queued.contact_key).await?;
    let state = current.as_ref().map(|found| found.state.as_str());
    let open = rules::window(queued.last_inbound, queued.now).is_some();
    let refusal = match (queued.whatsapp_number_id, state) {
        _ if !queued.sendable => Some("not_sendable"),
        (None, _) => Some("sender_unavailable"),
        (_, Some("opt_out")) => Some("opted_out"),
        _ if queued.template_sid.is_some() && state != Some("opt_in") => Some("no_agreement"),
        _ if queued.template_sid.is_none() && !open => Some("outside_window"),
        _ => None,
    };
    if let Some(code) = refusal {
        settle(&mut tx, job, "failed", None, code).await?;
        tx.commit().await?;
        return Ok(Err(Outcome::Failed { code }));
    }
    settle(&mut tx, job, "sending", None, "").await?;
    tx.commit().await?;
    let number = queued.whatsapp_number_id.unwrap_or_default();
    Ok(Ok((queued, number)))
}

/// Settles the message from Twilio's answer. A retry before acceptance returns it to
/// `queued` until the last attempt.
async fn finish(
    sender: &InboxSender,
    job: &Job,
    conversation: Uuid,
    sent: Sent,
) -> ApiResult<Outcome> {
    let mut tx = sender.pool.begin().await?;
    let outcome = match sent {
        Sent::Accepted(sid) => {
            settle(&mut tx, job, "sent", sid.as_deref(), "").await?;
            Outcome::Sent
        }
        Sent::Retry { after, code } if !exhausted(job) => {
            settle(&mut tx, job, "queued", None, "").await?;
            Outcome::Retry { after, code }
        }
        Sent::Retry { code, .. } | Sent::Failed { code } => {
            settle(&mut tx, job, "failed", None, code).await?;
            let workspace = &job.workspace_id;
            events::append(&mut tx, workspace, conversation, None, "send_failed").await?;
            Outcome::Failed { code }
        }
        Sent::Unknown { code } => {
            settle(&mut tx, job, "unknown", None, code).await?;
            Outcome::Unknown { code }
        }
    };
    tx.commit().await?;
    Ok(outcome)
}
