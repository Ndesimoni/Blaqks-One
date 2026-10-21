//! Provider webhooks (docs/messaging-design.md §7, packet X2) on the public prefix
//! `/api/integrations/webhooks/{provider}` (decision D10): no CRM cookie, CSRF token or
//! workspace path. The signature is verified over the raw body before anything else; a
//! verified event gets a receipt and a sealed staging row, and the worker processes it.
//! X2 ships the local `stub` provider; SendGrid's signed delivery events arrive on their
//! own per-connection route (E3b, `sendgrid.rs`).
pub mod cleanup;
pub mod inbound;
mod inbound_store;
pub mod message;
mod receipt;
mod sendgrid;
pub mod signature;
pub mod sink;
mod store;
mod stub;

#[cfg(test)]
mod inbound_fixtures;
#[cfg(test)]
mod inbound_tests;

use crate::{error::ApiError, state::AppState};
use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, Path, State},
    http::{header, HeaderMap, StatusCode},
    routing::post,
    Router,
};

/// Design §7: bodies over 1 MiB are refused before verification.
pub const MAX_BODY: usize = 1024 * 1024;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/integrations/webhooks/{provider}",
            post(receive).layer(DefaultBodyLimit::max(MAX_BODY)),
        )
        // SendGrid's signed delivery events, one URL per connection (E3b).
        .route(
            "/api/integrations/webhooks/sendgrid/{connection}/events",
            post(sendgrid::events).layer(DefaultBodyLimit::max(MAX_BODY)),
        )
}

/// Answers `202` with no body once the event is stored (or was already stored), `401` for
/// any event that fails verification, and writes nothing in that case (SEC-3).
async fn receive(
    State(state): State<AppState>,
    Path(provider): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, ApiError> {
    if !accepts(&provider, state.config.secure_cookie) {
        return Err(ApiError(
            StatusCode::NOT_FOUND,
            "API route not found.",
            "not_found",
        ));
    }
    let json = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.trim_start().starts_with("application/json"));
    if !json {
        return Err(ApiError(
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "Send the event as JSON.",
            "unsupported_media_type",
        ));
    }
    let key = super::handlers::key(&state)?.clone();
    let verified = stub::verify(&state.pool, &key, &headers, &body).await?;
    receipt::store(&state.pool, &key, &verified, &body).await?;
    Ok(StatusCode::ACCEPTED)
}

/// Only the local stub exists in X2, and never on a hosted (secure-cookie) server.
pub fn accepts(provider: &str, hosted: bool) -> bool {
    provider == "stub" && !hosted
}

/// The single answer for every verification failure, so a caller learns nothing about
/// which check failed or whether an account exists.
pub fn rejected() -> ApiError {
    ApiError(
        StatusCode::UNAUTHORIZED,
        "The event could not be verified.",
        "invalid_signature",
    )
}
