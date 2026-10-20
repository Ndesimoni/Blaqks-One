//! New-contact review (plan §2.2, design §4): Create lead, Link to an existing record and
//! Not a lead. Each runs under the workspace lock on the versioned conversation, so two
//! people acting on one message produce one lead.
use super::{change, leads, normalize};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    records::lookup,
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::Value;
use uuid::Uuid;

pub const LINKED: &str = "This conversation is already linked to a record.";
pub const CHOOSE: &str = "Several records match this sender. Link the right one instead.";
pub const BLOCKED: &str = "Unblock the sender first.";

use change::{json, optional_text, Body};

/// Links the conversation to a record and opens it if it was new.
async fn link_to(
    lk: &mut change::Locked,
    collection: &str,
    record: Uuid,
    holder: Option<Uuid>,
) -> ApiResult<()> {
    sqlx::query(
        "UPDATE inbox.crm_inbox_conversations SET match_state='linked',linked_collection=$2, \
           linked_record_id=$3,suggested_lead=false,assignee_id=coalesce(assignee_id,$4), \
           state=CASE WHEN state='new' THEN 'open' ELSE state END, \
           version=version+1,updated_at=now() WHERE id=$1",
    )
    .bind(lk.id())
    .bind(collection)
    .bind(record)
    .bind(holder)
    .execute(&mut *lk.tx)
    .await?;
    Ok(())
}

/// `POST …/lead {expectedVersion, name?, notes?}`: creates a Client in stage New as the caller,
/// who needs the Clients create grant (checked again by the records module).
pub async fn lead(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Body,
) -> ApiResult<Json<Value>> {
    let (version, fields) = change::fields(json(body)?, &["name", "notes"])?;
    let name = optional_text(fields.get("name"), 120)?;
    let notes = optional_text(fields.get("notes"), 2000)?;
    let mut lk = change::begin(&state, &session, &headers, workspace, &id, version).await?;
    if lk.row.linked_record_id.is_some() {
        return Err(ApiError::conflict(LINKED));
    }
    // Several matches need a person's choice; only the Admin may still add a new lead (X3-S3).
    if lk.row.match_state == "choice" && !lk.viewer.manager {
        return Err(ApiError::conflict(CHOOSE));
    }
    let contact = normalize::contact(&lk.row.channel, &lk.row.contact_display)
        .ok_or(ApiError::invalid(change::INVALID))?;
    let name = name.or_else(|| lk.row.contact_name.clone());
    let (actor, ws, channel) = (lk.viewer.id, lk.workspace.clone(), lk.row.channel.clone());
    let entry = leads::create(
        &mut lk.tx,
        actor,
        &ws,
        &channel,
        &contact,
        name.as_deref(),
        notes.as_deref(),
    )
    .await?;
    link_to(&mut lk, "Clients", entry.id, entry.assignee).await?;
    lk.event("lead_created").await?;
    lk.finish().await
}

/// `POST …/link {expectedVersion, collection, recordId}`: only to a Client or Contact the
/// caller can see; anything else is the same not-found (SEC-8).
pub async fn link(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Body,
) -> ApiResult<Json<Value>> {
    let (version, fields) = change::fields(json(body)?, &["collection", "recordId"])?;
    let collection = fields
        .get("collection")
        .and_then(Value::as_str)
        .filter(|name| ["Clients", "Contacts"].contains(name))
        .ok_or(ApiError::invalid(change::INVALID))?
        .to_owned();
    let record = fields
        .get("recordId")
        .and_then(Value::as_str)
        .and_then(|value| Uuid::parse_str(value).ok())
        .ok_or_else(ApiError::missing)?;
    let mut lk = change::begin(&state, &session, &headers, workspace, &id, version).await?;
    if lk.row.linked_record_id.is_some() {
        return Err(ApiError::conflict(LINKED));
    }
    let ws = lk.workspace.clone();
    lookup::summary(&mut lk.tx, &ws, &lk.user, &collection, record)
        .await?
        .ok_or_else(ApiError::missing)?;
    link_to(&mut lk, &collection, record, None).await?;
    lk.event("linked").await?;
    lk.finish().await
}

/// `POST …/resolve {expectedVersion}`: Not a lead. The conversation is resolved and its
/// suggestion cleared; a later message reopens it.
pub async fn resolve(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Body,
) -> ApiResult<Json<Value>> {
    let (version, _) = change::fields(json(body)?, &[])?;
    let mut lk = change::begin(&state, &session, &headers, workspace, &id, version).await?;
    if lk.row.state == "spam" {
        return Err(ApiError::conflict(BLOCKED));
    }
    sqlx::query(
        "UPDATE inbox.crm_inbox_conversations SET state='resolved',suggested_lead=false, \
           version=version+1,updated_at=now() WHERE id=$1",
    )
    .bind(lk.id())
    .execute(&mut *lk.tx)
    .await?;
    lk.event("state_changed").await?;
    lk.finish().await
}
