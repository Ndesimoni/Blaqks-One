//! What the WhatsApp composer needs (W1b, design §5 and §18): whether the caller may send
//! in this conversation and why not, the 24-hour window, the client's consent and the
//! offered templates. `GET /inbox/whatsapp/start` answers the same for a Start message to a
//! record. The sending routes enforce every rule again; this only explains them.
use super::{
    access::Viewer,
    consent,
    read::load,
    send::{whatsapp, whatsapp_rules as rules},
};
use crate::{auth::profile::UserRow, error::ApiResult, integrations::whatsapp as numbers};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'a, 'b> = &'a mut Transaction<'b, Postgres>;

/// `conversation.whatsapp` for a visible WhatsApp conversation.
pub async fn conversation(
    tx: Tx<'_, '_>,
    workspace: &str,
    user: &UserRow,
    id: Uuid,
) -> ApiResult<Value> {
    let thread = whatsapp::thread(tx, id).await?;
    let held = match thread.whatsapp_number_id {
        Some(number) => numbers::number(tx, workspace, number).await?,
        None => None,
    };
    let current = consent::latest(tx, workspace, &thread.contact_key).await?;
    let opted = current.as_ref().map(|found| found.state.as_str());
    let granted = user.role == "admin" || user.channel_access.0.whatsapp;
    let refusal = match &held {
        _ if !granted => Some("no_grant"),
        None => Some("unsupported"),
        Some(held) if held.member_id != user.id => Some("other_number"),
        Some(held) if !held.active => Some("number_disconnected"),
        Some(held) if !held.account_connected => Some("account_reconnect"),
        _ if thread.state == "spam" || thread.blocked => Some("not_sendable"),
        _ if opted == Some("opt_out") => Some("opted_out"),
        _ => None,
    };
    let window = rules::window(thread.last_inbound, thread.now);
    let can_send = refusal.is_none();
    let templates = match (&held, can_send) {
        (Some(held), true) => numbers::templates(tx, workspace, held.connection_id).await?,
        _ => Vec::new(),
    };
    let templates: Vec<Value> = templates.iter().map(numbers::Template::view).collect();
    Ok(json!({
        "numberId": thread.whatsapp_number_id,
        "numberOwnerId": held.as_ref().map(|held| held.member_id),
        // A colleague's own number is theirs to share (W1b review L3).
        "numberPhone": held
            .as_ref()
            .filter(|held| held.member_id == user.id || user.role == "admin")
            .map(|held| held.phone.clone()),
        "canSend": can_send,
        "canSendText": can_send && window.is_some(),
        "canSendTemplate": can_send && opted == Some("opt_in") && !templates.is_empty(),
        "refusal": refusal,
        "window": {"open": window.is_some(), "until": window.and_then(rules::until)},
        "consent": consent::view(current.as_ref(), user),
        "templates": templates,
    }))
}

/// The Start message state for one visible record (`None` when hidden or missing).
pub async fn start(
    tx: Tx<'_, '_>,
    workspace: &str,
    user: &UserRow,
    collection: &str,
    record: Uuid,
) -> ApiResult<Option<Value>> {
    let recipient = crate::records::recipient::recipient(tx, workspace, user, collection, record);
    let Some(found) = recipient.await? else {
        return Ok(None);
    };
    let key = found
        .phone
        .as_deref()
        .and_then(super::normalize::whatsapp_key);
    let granted = user.role == "admin" || user.channel_access.0.whatsapp;
    let number = numbers::own_number(tx, workspace, user.id).await?;
    let current = match &key {
        Some(key) => consent::latest(tx, workspace, key).await?,
        None => None,
    };
    let opted = current.as_ref().map(|found| found.state.as_str());
    let blocked: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM inbox.crm_inbox_blocks \
         WHERE workspace_id=$1 AND channel='whatsapp' AND contact_key=$2)",
    )
    .bind(workspace)
    .bind(key.as_deref().unwrap_or(""))
    .fetch_one(&mut **tx)
    .await?;
    let (mut conversation, mut held) = (None, false);
    if let (Some(number), Some(key)) = (&number, &key) {
        let thread: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM inbox.crm_inbox_conversations \
             WHERE connection_id=$1 AND external_thread_id=$2",
        )
        .bind(number.connection_id)
        .bind(format!("wa:{}:{key}", number.id))
        .fetch_optional(&mut **tx)
        .await?;
        if let Some(thread) = thread {
            conversation = load(tx, workspace, &Viewer::of(user), thread, false)
                .await?
                .map(|row| row.id);
            held = conversation.is_none();
        }
    }
    let refusal = match &number {
        _ if !granted => Some("no_grant"),
        None => Some("no_number"),
        Some(number) if !number.account_connected => Some("account_reconnect"),
        _ if key.is_none() => Some("no_phone"),
        _ if blocked => Some("blocked"),
        _ if opted == Some("opt_out") => Some("opted_out"),
        _ if held => Some("conversation_held"),
        _ if opted != Some("opt_in") => Some("no_agreement"),
        _ => None,
    };
    let templates = match (&number, granted) {
        (Some(number), true) => numbers::templates(tx, workspace, number.connection_id).await?,
        _ => Vec::new(),
    };
    let templates: Vec<Value> = templates.iter().map(numbers::Template::view).collect();
    Ok(Some(json!({
        "number": number.map(|number| json!({"id": number.id, "phone": number.phone})),
        "contact": key.map(|phone| json!({"phone": phone})),
        "consent": consent::view(current.as_ref(), user),
        "canStart": refusal.is_none(),
        "refusal": refusal,
        "conversationId": conversation,
        "templates": templates,
    })))
}
