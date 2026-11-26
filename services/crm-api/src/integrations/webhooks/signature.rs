//! HMAC-SHA256 webhook signatures (design §7), compared in constant time by `hmac`.
use hmac::{Hmac, Mac};
use sha2::Sha256;

const PREFIX: &str = "sha256=";

/// Checks `header` (`sha256=` and 64 lower- or upper-case hex digits) against the HMAC of
/// the exact raw body. Anything malformed is simply not valid.
pub fn verify_sha256(secret: &[u8], body: &[u8], header: &str) -> bool {
    let Some(expected) = header.strip_prefix(PREFIX).and_then(decode_hex) else {
        return false;
    };
    let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(secret) else {
        return false;
    };
    mac.update(body);
    mac.verify_slice(&expected).is_ok()
}

/// `sha256=<hex>` for `body`; used by tests and local tools that send stub events.
pub fn sign_sha256(secret: &[u8], body: &[u8]) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret).expect("HMAC accepts any key length");
    mac.update(body);
    let digest = mac.finalize().into_bytes();
    let hex: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();
    format!("{PREFIX}{hex}")
}

fn decode_hex(text: &str) -> Option<Vec<u8>> {
    if text.len() != 64 || !text.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }
    (0..text.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(&text[index..index + 2], 16).ok())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_exact_body_and_secret_verify() {
        let header = sign_sha256(b"synthetic-secret", br#"{"event":"one"}"#);
        assert!(verify_sha256(
            b"synthetic-secret",
            br#"{"event":"one"}"#,
            &header
        ));
        assert!(verify_sha256(
            b"synthetic-secret",
            br#"{"event":"one"}"#,
            &header.to_uppercase().replace("SHA256=", "sha256=")
        ));
        assert!(!verify_sha256(
            b"other-secret",
            br#"{"event":"one"}"#,
            &header
        ));
        assert!(!verify_sha256(
            b"synthetic-secret",
            br#"{"event":"two"}"#,
            &header
        ));
        assert!(!verify_sha256(b"synthetic-secret", b"", "sha256="));
        assert!(!verify_sha256(b"synthetic-secret", b"", &header[7..]));
        assert!(!verify_sha256(
            b"synthetic-secret",
            b"",
            &format!("{header}00")
        ));
        assert!(!verify_sha256(b"synthetic-secret", b"", "sha256=zz"));
    }
}
