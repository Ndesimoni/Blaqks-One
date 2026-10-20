//! The local stub provider's webhook format, used by tests and development tools only:
//! `X-Stub-Provider` and `X-Stub-Account` name a live connection, `X-Stub-Event` is the
//! provider event ID and `X-Stub-Signature` is `sha256=` HMAC of `<event ID>.<raw body>`
//! keyed with that connection's credential, so the deduplication key is signed too
//! (X2-S1); real adapters take it only from signed material. Only the provider and
//! account headers are read before verification, to choose the key (as Twilio's
//! `AccountSid` will be).
use super::{rejected, signature, store};
use crate::{
    config::messaging_settings::MessagingKey,
    error::ApiResult,
    integrations::{crypto, model::Provider},
};
use axum::http::HeaderMap;
use sqlx::PgPool;

pub struct Verified {
    pub connection: store::Secret,
    pub event_id: String,
}

fn header<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|value| value.to_str().ok())
}

/// Event IDs are opaque provider tokens: 1–200 characters of letters, digits and `._:-`.
pub fn event_id(value: &str) -> Option<String> {
    let ok = (1..=200).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"._:-".contains(&byte));
    ok.then(|| value.to_owned())
}

/// The exact bytes the stub signs: the event ID, a dot, then the raw body.
pub fn signed_message(event_id: &str, body: &[u8]) -> Vec<u8> {
    let mut message = format!("{event_id}.").into_bytes();
    message.extend_from_slice(body);
    message
}

pub async fn verify(
    pool: &PgPool,
    key: &MessagingKey,
    headers: &HeaderMap,
    body: &[u8],
) -> ApiResult<Verified> {
    let provider = header(headers, "x-stub-provider")
        .and_then(Provider::parse)
        .ok_or_else(rejected)?;
    let account = header(headers, "x-stub-account")
        .filter(|value| (1..=160).contains(&value.len()))
        .ok_or_else(rejected)?;
    let signed = header(headers, "x-stub-signature").ok_or_else(rejected)?;
    let event_id = header(headers, "x-stub-event")
        .and_then(event_id)
        .ok_or_else(rejected)?;
    let connection = store::secret(pool, provider.as_str(), account)
        .await?
        .ok_or_else(rejected)?;
    // Until the keyring (W1), only credentials sealed under the current key can be opened.
    if connection.key_version != key.version {
        return Err(rejected());
    }
    let aad = crypto::aad(
        &connection.workspace_id,
        &connection.id.to_string(),
        &connection.provider,
        &connection.channel,
        connection.key_version,
    );
    let credential = crypto::open(&key.bytes, &aad, &connection.sealed).map_err(|_| rejected())?;
    if !signature::verify_sha256(&credential, &signed_message(&event_id, body), signed) {
        return Err(rejected());
    }
    Ok(Verified {
        connection,
        event_id,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_event_id_is_part_of_what_is_signed() {
        let header = signature::sign_sha256(b"secret", &signed_message("evt-1", b"{}"));
        assert!(signature::verify_sha256(
            b"secret",
            &signed_message("evt-1", b"{}"),
            &header
        ));
        assert!(!signature::verify_sha256(
            b"secret",
            &signed_message("evt-2", b"{}"),
            &header
        ));
        assert!(event_id("evt_1.a:b-c").is_some());
        assert!(event_id("bad id").is_none());
        assert!(event_id(&"x".repeat(201)).is_none());
    }

    #[test]
    fn the_stub_route_never_exists_on_a_hosted_server() {
        assert!(super::super::accepts("stub", false));
        assert!(!super::super::accepts("stub", true));
        assert!(!super::super::accepts("twilio", false));
    }
}
