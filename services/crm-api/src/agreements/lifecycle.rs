//! Send and revoke (docs/agreements-design.md §4): sender-only commands.
use super::{
    access,
    command::{self, Command},
    ledger,
    model::{Party, State as AgreementState, INVALID},
    store,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use time::{format_description::well_known::Rfc3339, Duration, OffsetDateTime};

const ONLY_DRAFT: &str = "Only a draft can be sent.";
const ONLY_SENT: &str = "Only a sent agreement can be revoked.";
const EXPIRY_PASSED: &str = "This draft expires too soon. Revise its expiry before sending.";
const VERSION: [&str; 1] = ["expectedVersion"];

async fn start(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    path: (String, String),
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Command> {
    let (workspace, id) = path;
    let command = command::begin(state, session, headers, &workspace, &id, body, &VERSION).await?;
    access::require(command.party, Party::Sender)?;
    Ok(command)
}

/// Sends the draft's current revision. The recipient needs at least an hour to answer,
/// so a draft whose frozen expiry is closer than that must be revised first.
pub async fn send(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let mut command = start(&state, &session, &headers, path, body).await?;
    if command.row.state() != AgreementState::Draft {
        return Err(ApiError::conflict(ONLY_DRAFT));
    }
    let id = command.row.id;
    let revision = store::current(&mut command.tx, id).await?;
    let expires = revision.terms["expiresAt"]
        .as_str()
        .and_then(|raw| OffsetDateTime::parse(raw, &Rfc3339).ok())
        .ok_or(ApiError::invalid(INVALID))?;
    if expires <= OffsetDateTime::now_utc() + Duration::hours(1) {
        return Err(ApiError::conflict(EXPIRY_PASSED));
    }
    let tx = &mut command.tx;
    let version = ledger::bump(tx, id, command.row.version, "sent", Some(expires), None).await?;
    ledger::event(
        tx,
        id,
        Some(revision.id),
        "sent",
        command.actor,
        Party::Sender,
    )
    .await?;
    command.commit("sent", version, json!({})).await
}

/// Withdraws a sent offer, including an expired one. Impossible after acceptance.
pub async fn revoke(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let mut command = start(&state, &session, &headers, path, body).await?;
    if command.row.state() != AgreementState::Sent {
        return Err(ApiError::conflict(ONLY_SENT));
    }
    let id = command.row.id;
    let revision = store::current(&mut command.tx, id).await?;
    let tx = &mut command.tx;
    let version = ledger::bump(tx, id, command.row.version, "revoked", None, None).await?;
    ledger::event(
        tx,
        id,
        Some(revision.id),
        "revoked",
        command.actor,
        Party::Sender,
    )
    .await?;
    command.commit("revoked", version, json!({})).await
}
