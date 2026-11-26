//! `POST /api/integrations/webhooks/twilio/{connection}/status?m={message}` (W1b, design §5,
//! §6 and §18). Public: no CRM cookie or CSRF. Before any body byte is read: a form content
//! type, an `X-Twilio-Signature` of 20 bytes, the query exactly `m=` and a lower-case UUID
//! (so `bodySHA256` and anything else is refused), a declared length within 64 KiB,
//! `CRM_PUBLIC_URL` set, and a live Twilio connection whose token opens. Then at most 64
//! KiB counted while streaming, a form with no repeated name, and HMAC-SHA1 over the URL
//! built from `CRM_PUBLIC_URL` (W-L1). Every refusal is the same `401`, writes nothing and
//! is counted (X2-S7). A verified callback is answered `200`, changed or not.
use super::{rejected, twilio_apply};
use crate::{
    error::ApiError,
    integrations::{credential, handlers::key, store, twilio::signature},
    state::AppState,
};
use axum::{
    body::{to_bytes, Body},
    extract::{Path, RawQuery, State},
    http::{header, HeaderMap, StatusCode},
};
use std::sync::atomic::{AtomicU64, Ordering};
use uuid::Uuid;

pub const MAX_STATUS: usize = 64 * 1024;
static REFUSALS: AtomicU64 = AtomicU64::new(0);

/// Counts each refusal; every hundredth is noted in the log (no request detail).
fn refused() -> ApiError {
    let count = REFUSALS.fetch_add(1, Ordering::Relaxed) + 1;
    if count % 100 == 0 {
        eprintln!("CRM refused {count} unverified Twilio webhook requests so far.");
    }
    rejected()
}

/// The message named by the query, only in its one canonical form.
pub fn message_query(query: Option<&str>) -> Option<Uuid> {
    let value = query?.strip_prefix("m=")?;
    let id = Uuid::parse_str(value).ok()?;
    (id.hyphenated().to_string() == value).then_some(id)
}

pub async fn status(
    State(state): State<AppState>,
    Path(connection): Path<String>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
    body: Body,
) -> Result<StatusCode, ApiError> {
    let text = |name: &str| headers.get(name).and_then(|value| value.to_str().ok());
    let form = text(header::CONTENT_TYPE.as_str()).is_some_and(|value| {
        let kind = value.split(';').next().unwrap_or("").trim();
        kind.eq_ignore_ascii_case("application/x-www-form-urlencoded")
    });
    let signature = text("x-twilio-signature").and_then(signature::header_bytes);
    let message = message_query(query.as_deref());
    // A declared length must be a number within the limit; a chunked body has none.
    let small = match text(header::CONTENT_LENGTH.as_str()) {
        Some(value) => value
            .parse::<usize>()
            .is_ok_and(|length| length <= MAX_STATUS),
        None => true,
    };
    let public = state.config.twilio.public_url.clone();
    let connection = Uuid::parse_str(&connection).ok();
    let (true, Some(signature), Some(message), true, Some(public), Some(connection)) =
        (form, signature, message, small, public, connection)
    else {
        return Err(refused());
    };
    let key = key(&state)?.clone();
    let mut tx = state.pool.begin().await?;
    let workspace: Option<String> = sqlx::query_scalar(
        "SELECT workspace_id FROM integrations.crm_channel_connections \
         WHERE id=$1 AND provider='twilio' AND state<>'disconnected'",
    )
    .bind(connection)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(workspace) = workspace else {
        return Err(refused());
    };
    let row = store::load(&mut tx, &workspace, connection).await?;
    let Some(row) = row else {
        return Err(refused());
    };
    let token = credential::open(&mut tx, &key, &row).await?;
    tx.commit().await?;
    let Some(token) = token else {
        return Err(refused());
    };
    // The body is read only after every cheap refusal.
    let body = to_bytes(body, MAX_STATUS).await.map_err(|_| refused())?;
    let params = signature::parse_form(&body).ok_or_else(refused)?;
    let url = format!("{public}/api/integrations/webhooks/twilio/{connection}/status?m={message}");
    if !signature::verify(&token, &signature::signed_text(&url, &params), &signature) {
        return Err(refused());
    }
    let account = params.iter().find(|(name, _)| name == "AccountSid");
    if account.map(|(_, value)| value.as_str()) != Some(row.external_account_id.as_str()) {
        return Err(refused());
    }
    twilio_apply::apply(&state.pool, &row, message, &params).await?;
    Ok(StatusCode::OK)
}

#[cfg(test)]
mod tests {
    use super::message_query;

    #[test]
    fn only_one_lower_case_message_query_is_accepted() {
        let id = "0b5e6c7a-1d2e-4f30-9a8b-7c6d5e4f3a2b";
        assert!(message_query(Some(&format!("m={id}"))).is_some());
        assert!(message_query(None).is_none());
        let refused = [
            String::new(),
            "m=".into(),
            format!("m={}", id.to_uppercase()),
            format!("m={}", id.replace('-', "")),
            format!("m={id}&bodySHA256=abc"),
            format!("bodySHA256=abc&m={id}"),
            format!("m={id}#x"),
        ];
        for query in &refused {
            assert!(message_query(Some(query)).is_none(), "{query}");
        }
    }
}
