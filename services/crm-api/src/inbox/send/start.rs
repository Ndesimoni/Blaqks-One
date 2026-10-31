//! `POST /inbox/conversations`: Start message. A new email thread to a Client or Contact
//! the caller may see, sent through the caller's own mailbox, linked to that record and
//! assigned to the caller. Gmail's thread ID replaces the `crm:` placeholder once sent.
use super::{body, object, sender, store, SUBJECT};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    inbox::{access, events, normalize},
    integrations::mail,
    records::recipient,
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

const START: &str = "Choose a client or contact and write a subject and message.";
const NO_EMAIL: &str = "This record has no valid email address.";

pub async fn start(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    request: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    let Json(mut request) = request.map_err(|_| ApiError::invalid(START))?;
    let attachments = super::files::take(&mut request)?;
    let map = object(
        request,
        &["collection", "recordId", "subject", "body"],
        START,
    )?;
    let collection = map
        .get("collection")
        .and_then(Value::as_str)
        .filter(|value| matches!(*value, "Clients" | "Contacts"))
        .ok_or(ApiError::invalid(START))?
        .to_owned();
    let record = map
        .get("recordId")
        .and_then(Value::as_str)
        .and_then(|value| Uuid::parse_str(value).ok())
        .ok_or(ApiError::invalid(START))?;
    let subject = map
        .get("subject")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| mail::subject_ok(value))
        .ok_or(ApiError::invalid(SUBJECT))?
        .to_owned();
    let text = body(&map, "body")?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let mailbox = sender(&mut tx, &workspace, &user).await?;
    // A record the caller cannot see is indistinguishable from a missing one.
    let found = recipient::recipient(&mut tx, &workspace, &user, &collection, record)
        .await?
        .ok_or_else(ApiError::missing)?;
    let address = found
        .email
        .as_deref()
        .and_then(normalize::email)
        .filter(|address| mail::plain_address(address))
        .ok_or(ApiError::invalid(NO_EMAIL))?;
    let id = Uuid::new_v4();
    let name: Option<String> = found
        .name
        .map(|name| name.trim().chars().take(120).collect());
    let blocked = sqlx::query(
        "INSERT INTO inbox.crm_inbox_conversations (id,workspace_id,channel,connection_id, \
           external_thread_id,contact_key,contact_display,contact_name,match_state, \
           linked_collection,linked_record_id,assignee_id,state,subject) \
         SELECT $1,$2,'email',$3,'crm:'||$1,$4,$4,NULLIF($5,''),'linked',$6,$7,$8,'waiting',$9 \
         WHERE NOT EXISTS (SELECT 1 FROM inbox.crm_inbox_blocks \
           WHERE workspace_id=$2 AND channel='email' AND contact_key=$4)",
    )
    .bind(id)
    .bind(&workspace)
    .bind(mailbox)
    .bind(&address)
    .bind(name.as_deref().unwrap_or(""))
    .bind(&collection)
    .bind(record)
    .bind(user.id)
    .bind(&subject)
    .execute(&mut *tx)
    .await?
    .rows_affected()
        == 0;
    if blocked {
        return Err(ApiError::invalid("This address is blocked."));
    }
    events::append(&mut tx, &workspace, id, Some(user.id), "started").await?;
    let mut message = store::queue(&mut tx, &workspace, id, user.id, &text, None).await?;
    let files = super::files::attach(
        &mut tx,
        &workspace,
        user.id,
        mailbox,
        &message,
        &attachments,
    );
    message["attachments"] = json!(files.await?);
    tx.commit().await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({ "conversationId": id, "message": message })),
    ))
}
