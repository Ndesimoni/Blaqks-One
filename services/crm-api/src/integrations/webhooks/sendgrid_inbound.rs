//! `POST /api/integrations/webhooks/sendgrid/{connection}/inbound` (E3c, design §6).
//! Public: no CRM cookie or CSRF. Before any body byte is read (review M2): a form content
//! type with a boundary, both signature headers, a fresh timestamp, a declared length within
//! 25 MiB, a live connection with a stored key, then one of that connection's slots; the
//! body must arrive within 30 seconds. Then the ECDSA signature over the timestamp and raw
//! body, then a strict form parse. Verification failures are the same `401` and write nothing; a verified post
//! that is not client mail is answered `200` so SendGrid does not send it again.
use super::rejected;
use crate::{
    error::ApiError,
    inbox::intake,
    integrations::{
        sendgrid::{events, inbound, inbound_event, multipart, webhooks},
        webhooks::inbound::SinkError,
    },
    state::AppState,
};
use axum::{
    body::{to_bytes, Body},
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
};
use std::time::Duration;
use uuid::Uuid;

/// SendGrid's own limit is 30 MB; larger mail is refused and is a known limit.
pub const MAX_MAIL: usize = 25 * 1024 * 1024;
/// A post must arrive whole within this time, or its slot is freed (review M1).
const READ_DEADLINE: Duration = Duration::from_secs(30);

fn status(code: StatusCode, message: &'static str) -> ApiError {
    ApiError(code, message, "inbound_refused")
}

pub async fn inbound(
    State(state): State<AppState>,
    Path(connection): Path<String>,
    headers: HeaderMap,
    body: Body,
) -> Result<StatusCode, ApiError> {
    let text = |name: &str| headers.get(name).and_then(|value| value.to_str().ok());
    let boundary = text(header::CONTENT_TYPE.as_str()).and_then(multipart::boundary);
    let signature = text("x-twilio-email-event-webhook-signature")
        .filter(|value| (1..=200).contains(&value.len()));
    let timestamp = text("x-twilio-email-event-webhook-timestamp").unwrap_or_default();
    let now = time::OffsetDateTime::now_utc().unix_timestamp();
    let (Some(boundary), Some(signature), true) =
        (boundary, signature, events::fresh(timestamp, now))
    else {
        return Err(rejected());
    };
    let declared =
        text(header::CONTENT_LENGTH.as_str()).and_then(|value| value.parse::<usize>().ok());
    if declared.is_some_and(|length| length > MAX_MAIL) {
        return Err(status(
            StatusCode::PAYLOAD_TOO_LARGE,
            "This mail is too large.",
        ));
    }
    let connection = Uuid::parse_str(&connection).map_err(|_| rejected())?;
    let stored = webhooks::key(&state.pool, connection, webhooks::Kind::Inbound).await?;
    let Some((workspace, public_key, domain)) = stored else {
        return Err(rejected());
    };
    let Some(_slot) = super::inbound_slots::take(connection) else {
        return Err(status(StatusCode::SERVICE_UNAVAILABLE, "Busy. Try again."));
    };
    let read = tokio::time::timeout(READ_DEADLINE, to_bytes(body, MAX_MAIL)).await;
    let Ok(Ok(body)) = read else {
        return Err(rejected());
    };
    if !events::verified(&public_key, timestamp, signature, &body) {
        return Err(rejected());
    }
    let Some(mail) = multipart::parse(&body, &boundary).and_then(|form| inbound::read(&form))
    else {
        return Ok(StatusCode::OK);
    };
    let Some(event) =
        inbound_event::event(&state.pool, &workspace, connection, &domain, mail).await?
    else {
        return Ok(StatusCode::OK);
    };
    match intake::receive(&state.pool, &event).await {
        // SendGrid posts it again later.
        Err(SinkError::Retry) => Err(status(StatusCode::SERVICE_UNAVAILABLE, "Try again.")),
        Ok(()) | Err(SinkError::Permanent(_)) => Ok(StatusCode::OK),
    }
}
