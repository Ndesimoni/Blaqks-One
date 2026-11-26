//! `POST /api/public/blaqks-one/contact` (BO1e, docs/blaqks-one-console.md §11): the
//! marketing website's contact form, relayed server to server by the site's own route,
//! which checks the visitor's browser origin. Like the website enquiry intake it takes no
//! cookie or session, trusts a forwarded client address only from a configured proxy
//! (`ClientKeys`), and is held by a per-client and a global budget and a 16 KiB body limit.
//! A filled `website` field is the form's hidden trap: the answer is the same and nothing
//! is kept. A real message becomes a new client from the website form, at New and
//! unassigned, whose `created` entry is the message. The answer never says more.
use super::{events, input, rules, store, timeline};
use crate::{
    auth::throttle,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, ConnectInfo, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::net::SocketAddr;

/// Per sending address (in practice the relay) and for everyone together.
pub const PER_CLIENT: (i32, i32) = (20, 600);
pub const GLOBAL: (i32, i32) = (200, 3600);
const BUSY: &str = "Too many messages. Try again later.";
const INVALID: &str = "Provide a name and an email or phone.";
const TOO_LARGE: &str = "The message is too long.";

#[derive(Deserialize, Default)]
#[serde(default, deny_unknown_fields)]
pub struct Contact {
    name: String,
    company: String,
    email: String,
    phone: String,
    message: String,
    website: String,
}

fn received() -> (StatusCode, Json<Value>) {
    (StatusCode::ACCEPTED, Json(json!({ "received": true })))
}

pub async fn contact(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Result<Json<Contact>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let client = state.signup.clients.digest(peer, &headers)?;
    let budgets = [
        (format!("blaqks-one:contact:attempt:{client}"), PER_CLIENT),
        ("blaqks-one:contact:global".to_string(), GLOBAL),
    ];
    for (key, (limit, window)) in budgets {
        throttle::consume_window(&state.pool, &key, limit, window, BUSY, "rate_limited").await?;
    }
    let Json(body) = body.map_err(|rejection| match rejection.status() {
        StatusCode::PAYLOAD_TOO_LARGE => ApiError(rejection.status(), TOO_LARGE, "too_large"),
        _ => ApiError::invalid(INVALID),
    })?;
    if !body.website.trim().is_empty() {
        return Ok(received());
    }
    let fields = input::Fields {
        company_name: Some(body.company),
        contact_name: Some(body.name),
        phone: Some(body.phone),
        email: Some(body.email),
        source: "website_form".into(),
        ..input::Fields::fresh()
    }
    .checked()?;
    let message = rules::text(Some(body.message), 4000, input::TEXT)?;
    let mut tx = state.pool.begin().await?;
    let id = store::insert(&mut tx, &fields, None).await?;
    timeline::append(&mut tx, id, "created", message.as_deref(), None).await?;
    events::created(&mut tx, &fields.source, None).await?;
    tx.commit().await?;
    Ok(received())
}
