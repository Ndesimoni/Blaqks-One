//! `POST /api/integrations/webhooks/sendgrid/{connection}/events` (E3b, design §6). Public:
//! no CRM cookie or CSRF. Cheap refusals come first (content type, signature and timestamp
//! headers, a fresh timestamp, a live connection with a stored key); then the ECDSA
//! signature over the timestamp and raw body; only then is the JSON parsed. Every failure
//! is the same `401`, and nothing is written. Verified events go to the Inbox.
use super::{rejected, MAX_BODY};
use crate::{
    error::ApiError,
    inbox::send::delivery::{self, Update},
    integrations::sendgrid::{events, webhooks},
    state::AppState,
};
use axum::{
    body::{to_bytes, Body},
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
};
use uuid::Uuid;

const SIGNATURE: &str = "x-twilio-email-event-webhook-signature";
const TIMESTAMP: &str = "x-twilio-email-event-webhook-timestamp";

pub async fn events(
    State(state): State<AppState>,
    Path(connection): Path<String>,
    headers: HeaderMap,
    body: Body,
) -> Result<StatusCode, ApiError> {
    let text = |name| headers.get(name).and_then(|value| value.to_str().ok());
    let json = text(header::CONTENT_TYPE.as_str())
        .is_some_and(|value| value.trim_start().starts_with("application/json"));
    let signature = text(SIGNATURE).filter(|value| (1..=200).contains(&value.len()));
    let timestamp = text(TIMESTAMP).unwrap_or_default();
    let now = time::OffsetDateTime::now_utc().unix_timestamp();
    let (true, Some(signature), true) = (json, signature, events::fresh(timestamp, now)) else {
        return Err(rejected());
    };
    let connection = Uuid::parse_str(&connection).map_err(|_| rejected())?;
    let Some((workspace, public_key)) = webhooks::events_key(&state.pool, connection).await? else {
        return Err(rejected());
    };
    // The body is read only after every cheap refusal (design M2, review L2).
    let body = to_bytes(body, MAX_BODY).await.map_err(|_| rejected())?;
    if !events::verified(&public_key, timestamp, signature, &body) {
        return Err(rejected());
    }
    let parsed = events::parse(&body).ok_or_else(rejected)?;
    let updates: Vec<Update<'_>> = parsed
        .iter()
        .map(|event| Update {
            message: event.message,
            kind: event.kind,
            provider_id: event.provider_id.as_deref(),
        })
        .collect();
    delivery::apply(&state.pool, &workspace, connection, &updates).await?;
    Ok(StatusCode::OK)
}
