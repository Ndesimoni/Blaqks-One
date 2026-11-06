//! `POST /inbox/conversations` with `channel: "whatsapp"` (W1b, design §3 and §5): Start
//! message on WhatsApp to a Client or Contact the caller may see, from the caller's own
//! number. The thread is keyed `wa:{number row}:{client number}` (W-M3), linked to the
//! record and assigned to the caller; a thread the caller already sees on that number
//! gains the message instead. A new thread has no window, so it starts with a template.
use super::{
    content, whatsapp,
    whatsapp_queue::{prepare, queue},
    whatsapp_rules as rules,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    inbox::{
        access::{self, Viewer},
        events, normalize,
        read::load,
    },
    records::recipient,
    state::AppState,
    workspaces,
};
use axum::{http::StatusCode, Json};
use serde_json::{json, Map, Value};
use uuid::Uuid;

pub const START: &str = "Choose a client or contact and a WhatsApp template or message.";
pub const NO_PHONE: &str = "This record has no valid mobile number for WhatsApp.";
pub const HELD: &str = "A colleague holds this client's conversation on your number.";

/// `collection` and `recordId`, taken out of the request.
pub fn record(map: &mut Map<String, Value>) -> ApiResult<(String, Uuid)> {
    let collection = map
        .remove("collection")
        .and_then(|value| value.as_str().map(str::to_owned))
        .filter(|value| matches!(value.as_str(), "Clients" | "Contacts"));
    let record = map
        .remove("recordId")
        .and_then(|value| value.as_str().and_then(|text| Uuid::parse_str(text).ok()));
    collection.zip(record).ok_or(ApiError::invalid(START))
}

pub async fn start(
    state: &AppState,
    session: &Session,
    workspace: &str,
    request: Value,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let Value::Object(mut map) = request else {
        return Err(ApiError::invalid(START));
    };
    if map
        .remove("attachments")
        .is_some_and(|files| files.as_array().is_none_or(|list| !list.is_empty()))
    {
        return Err(ApiError::invalid(whatsapp::ATTACHMENTS));
    }
    let (collection, record) = record(&mut map)?;
    if !map.contains_key("body") && !map.contains_key("template") {
        return Err(ApiError::invalid(START));
    }
    let content = content(Value::Object(map))?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, workspace).await?;
    let user = access::live(&mut tx, workspace, session.user.id).await?;
    let number = whatsapp::sender(&mut tx, workspace, &user).await?;
    // A record the caller cannot see is indistinguishable from a missing one.
    let found = recipient::recipient(&mut tx, workspace, &user, &collection, record)
        .await?
        .ok_or_else(ApiError::missing)?;
    let key = found
        .phone
        .as_deref()
        .and_then(normalize::whatsapp_key)
        .ok_or(ApiError::invalid(NO_PHONE))?;
    let thread = format!("wa:{}:{key}", number.id);
    let existing: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM inbox.crm_inbox_conversations \
         WHERE connection_id=$1 AND external_thread_id=$2",
    )
    .bind(number.connection_id)
    .bind(&thread)
    .fetch_optional(&mut *tx)
    .await?;
    let id = match existing {
        Some(id) => load(&mut tx, workspace, &Viewer::of(&user), id, true)
            .await?
            .map(|row| row.id)
            .ok_or(super::conflict(HELD, "conversation_held"))?,
        None => Uuid::new_v4(),
    };
    if existing.is_none() {
        let name: Option<String> = found
            .name
            .map(|name| name.trim().chars().take(120).collect());
        let blocked = sqlx::query(
            "INSERT INTO inbox.crm_inbox_conversations (id,workspace_id,channel,connection_id, \
               external_thread_id,contact_key,contact_display,contact_name,match_state, \
               linked_collection,linked_record_id,assignee_id,state,whatsapp_number_id) \
             SELECT $1,$2,'whatsapp',$3,$4,$5,$5,NULLIF($6,''),'linked',$7,$8,$9,'waiting',$10 \
             WHERE NOT EXISTS (SELECT 1 FROM inbox.crm_inbox_blocks \
               WHERE workspace_id=$2 AND channel='whatsapp' AND contact_key=$5)",
        )
        .bind(id)
        .bind(workspace)
        .bind(number.connection_id)
        .bind(&thread)
        .bind(&key)
        .bind(name.as_deref().unwrap_or(""))
        .bind(&collection)
        .bind(record)
        .bind(user.id)
        .bind(number.id)
        .execute(&mut *tx)
        .await?
        .rows_affected()
            == 0;
        if blocked {
            return Err(ApiError::invalid("This number is blocked."));
        }
    }
    let thread = whatsapp::thread(&mut tx, id).await?;
    whatsapp::same_number(&mut tx, workspace, &thread, &number).await?;
    let window = rules::window(thread.last_inbound, thread.now);
    let prepared = prepare(
        &mut tx,
        workspace,
        number.connection_id,
        &key,
        window,
        content,
    );
    let prepared = prepared.await?;
    let message = queue(&mut tx, workspace, id, user.id, prepared, None).await?;
    let action = if existing.is_some() {
        "replied"
    } else {
        "started"
    };
    events::append(&mut tx, workspace, id, Some(user.id), action).await?;
    tx.commit().await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({ "conversationId": id, "message": message })),
    ))
}
