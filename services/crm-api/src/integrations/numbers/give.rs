//! `POST /whatsapp-numbers` `{memberId, phone}` (owning Admin, WQ3): gives a member their
//! own number. Twilio is asked first, outside the lock, whether the phone is an `ONLINE`
//! WhatsApp sender of the company's account; under the workspace lock the Admin, the
//! connection and the member are re-read live, and the unique indexes keep one active
//! number per member and each phone active in one company only.
use super::{may_have, senders, store, write};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    integrations::{access, store_write, twilio, wire},
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

const FIELDS: [&str; 2] = ["memberId", "phone"];
pub const NOT_MEMBER: &str = "Choose an active member of your team who may use WhatsApp.";
pub const NOT_SENDER: &str =
    "Choose a number that Twilio lists as an online WhatsApp sender of your account.";
const CHANGED: &str = "The company's Twilio account changed. Reload and try again.";

pub async fn give(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::ensure_admin(&state, &session, &headers, &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    let input = wire::exact(body, &FIELDS, wire::INVALID)?;
    let member = input
        .get("memberId")
        .and_then(Value::as_str)
        .and_then(|value| Uuid::parse_str(value).ok())
        .ok_or(ApiError::invalid(NOT_MEMBER))?;
    let phone = input
        .get("phone")
        .and_then(Value::as_str)
        .filter(|value| value.chars().count() <= 40)
        .and_then(twilio::senders::e164)
        .ok_or(ApiError::invalid(NOT_SENDER))?;
    let (connection, listed) = senders::read(&state, &workspace, session.user.id).await?;
    let sender = listed
        .into_iter()
        .find(|sender| sender.phone == phone && sender.status == twilio::senders::ONLINE)
        .ok_or(ApiError::invalid(NOT_SENDER))?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    access::live_admin(&mut tx, &workspace, session.user.id).await?;
    let live = senders::live(&mut tx, &workspace).await?;
    if live.map(|row| row.id) != Some(connection) {
        return Err(ApiError::stale(CHANGED));
    }
    let user = workspaces::member(&mut tx, &workspace, member)
        .await
        .map_err(|_| ApiError::invalid(NOT_MEMBER))?;
    if !may_have(&user, &workspace) {
        return Err(ApiError::invalid(NOT_MEMBER));
    }
    let new = store::NewNumber {
        workspace: &workspace,
        connection,
        member,
        phone: &phone,
        sender_sid: sender.sender_sid.as_deref(),
        actor: session.user.id,
    };
    let id = store::insert(&mut tx, &new).await?;
    store_write::event(
        &mut tx,
        &workspace,
        connection,
        write::CONNECTED,
        session.user.id,
    )
    .await?;
    let row = store::by_id(&mut tx, &workspace, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "number": row.view() }))))
}
