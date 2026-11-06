//! The latest 200 messages of a conversation as the staff API shows them, oldest first. A
//! message left `sending` for two minutes reads as `unknown` (E1b); email attachments (F3a)
//! are listed on the message that carries them, and a WhatsApp template message names its
//! template (W1b).
use crate::error::ApiResult;
use serde_json::{json, Value};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

const STAMP: &str = "to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')";

#[derive(FromRow)]
struct Message {
    id: Uuid,
    direction: String,
    status: String,
    body: String,
    has_media: bool,
    files_not_kept: i16,
    author_user_id: Option<Uuid>,
    repeat_of: Option<Uuid>,
    sender: Option<String>,
    sender_unverified: bool,
    failure_reason: Option<String>,
    template_sid: Option<String>,
    at: String,
}

pub async fn messages(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<Vec<Value>> {
    let messages: Vec<Message> = sqlx::query_as(&format!(
        "SELECT * FROM (SELECT id,direction,body,has_media,files_not_kept,author_user_id, \
           repeat_of,sender,sender_unverified,template_sid, \
           CASE WHEN status='sending' AND status_changed_at<now()-interval '2 minutes' \
             THEN 'unknown' ELSE status END AS status, \
           failure_reason,{STAMP} AS at,created_at FROM inbox.crm_inbox_messages \
           WHERE conversation_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200) latest \
         ORDER BY created_at,id"
    ))
    .bind(id)
    .fetch_all(&mut **tx)
    .await?;
    let ids: Vec<Uuid> = messages.iter().map(|m| m.id).collect();
    let views: Vec<Value> = messages
        .iter()
        .map(|m| {
            json!({
                "id": m.id, "direction": m.direction, "status": m.status, "body": m.body,
                "hasMedia": m.has_media, "filesNotKept": m.files_not_kept,
                "authorId": m.author_user_id, "failureReason": m.failure_reason,
                "repeatOf": m.repeat_of, "sender": m.sender,
                "senderUnverified": m.sender_unverified, "template": m.template_sid,
                "at": m.at,
            })
        })
        .collect();
    super::send::files::views(tx, &ids, views).await
}
