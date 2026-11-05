//! Signed SendGrid delivery events (E3b, design §6). The signature is ECDSA P-256 with
//! SHA-256 over the timestamp header followed by the raw body, checked against the public
//! key stored for the connection's own webhook; a timestamp more than five minutes from
//! now is refused. Only the event kinds the Inbox uses are kept, and only the message
//! UUID the CRM sent as its one custom argument identifies a message.
use base64::{engine::general_purpose::STANDARD, Engine};
use ring::signature::{UnparsedPublicKey, ECDSA_P256_SHA256_ASN1};
use serde::Deserialize;
use uuid::Uuid;

pub use crate::inbox::send::delivery::Kind;

pub const MAX_EVENTS: usize = 1000;
const WINDOW_SECONDS: i64 = 300;
/// The fixed DER prefix of a P-256 SubjectPublicKeyInfo; the point follows it.
const P256_SPKI: [u8; 26] = [
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
    0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
];

#[derive(Debug, PartialEq)]
pub struct Event {
    pub message: Uuid,
    pub kind: Kind,
    /// SendGrid's ID for the message, which starts with the `X-Message-Id` it returned.
    pub provider_id: Option<String>,
}

#[derive(Deserialize)]
struct Raw {
    event: Option<String>,
    inbox_message: Option<String>,
    sg_message_id: Option<String>,
}

/// Whether `timestamp` (Unix seconds) is within five minutes of `now`.
pub fn fresh(timestamp: &str, now: i64) -> bool {
    let digits = !timestamp.is_empty() && timestamp.len() <= 12;
    let digits = digits && timestamp.bytes().all(|byte| byte.is_ascii_digit());
    digits
        && timestamp
            .parse::<i64>()
            .is_ok_and(|seconds| (seconds - now).abs() <= WINDOW_SECONDS)
}

/// Verifies the base64 DER signature with the base64 SubjectPublicKeyInfo key.
pub fn verified(public_key: &str, timestamp: &str, signature: &str, body: &[u8]) -> bool {
    let (Ok(key), Ok(signature)) = (STANDARD.decode(public_key), STANDARD.decode(signature)) else {
        return false;
    };
    let Some(point) = key
        .strip_prefix(P256_SPKI.as_slice())
        .filter(|p| p.len() == 65)
    else {
        return false;
    };
    let mut signed = timestamp.as_bytes().to_vec();
    signed.extend_from_slice(body);
    UnparsedPublicKey::new(&ECDSA_P256_SHA256_ASN1, point)
        .verify(&signed, &signature)
        .is_ok()
}

/// The events the Inbox acts on; anything else, or malformed, is skipped. `None` when the
/// body is not a JSON array of at most [`MAX_EVENTS`] events.
pub fn parse(body: &[u8]) -> Option<Vec<Event>> {
    let raw: Vec<serde_json::Value> = serde_json::from_slice(body).ok()?;
    if raw.len() > MAX_EVENTS {
        return None;
    }
    let events = raw
        .into_iter()
        .filter_map(|value| serde_json::from_value::<Raw>(value).ok())
        .filter_map(|raw| {
            let kind = match raw.event.as_deref()? {
                "delivered" => Kind::Delivered,
                "bounce" => Kind::Bounced,
                "dropped" => Kind::Dropped,
                _ => return None,
            };
            let message = Uuid::parse_str(raw.inbox_message.as_deref()?).ok()?;
            let provider_id = raw.sg_message_id.filter(|id| {
                (1..=300).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_graphic())
            });
            Some(Event {
                message,
                kind,
                provider_id,
            })
        })
        .collect();
    Some(events)
}

#[cfg(test)]
#[path = "events_tests.rs"]
mod tests;
