//! Channel-credential encryption settings (docs/messaging-design.md §8). The key never
//! enters the database, logs or the browser. Outside local development a missing key
//! refuses startup; locally it disables channel connections. There is no plaintext fallback.
use base64::{engine::general_purpose::STANDARD, Engine};

#[derive(Clone)]
pub struct MessagingKey {
    pub bytes: [u8; 32],
    pub version: i32,
}

pub fn messaging_key(
    key: Option<String>,
    version: Option<String>,
    local: bool,
) -> Result<Option<MessagingKey>, String> {
    let Some(value) = key.filter(|text| !text.trim().is_empty()) else {
        if version.is_some() {
            return Err("CRM_MESSAGING_KEY_VERSION requires CRM_MESSAGING_KEY.".into());
        }
        if !local {
            return Err("CRM_MESSAGING_KEY is required outside local development.".into());
        }
        return Ok(None);
    };
    let decoded = STANDARD
        .decode(value.trim())
        .map_err(|_| "CRM_MESSAGING_KEY must be base64-encoded 32 bytes.")?;
    let bytes: [u8; 32] = decoded
        .try_into()
        .map_err(|_| "CRM_MESSAGING_KEY must be base64-encoded 32 bytes.")?;
    let version = match version {
        Some(value) => value
            .trim()
            .parse::<i32>()
            .map_err(|_| "CRM_MESSAGING_KEY_VERSION must be a positive whole number.")?,
        None => 1,
    };
    if version < 1 {
        return Err("CRM_MESSAGING_KEY_VERSION must be a positive whole number.".into());
    }
    Ok(Some(MessagingKey { bytes, version }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_parses_base64_and_defaults_the_version() {
        let value = STANDARD.encode([7u8; 32]);
        let key = messaging_key(Some(value), None, false).unwrap().unwrap();
        assert_eq!(key.bytes, [7u8; 32]);
        assert_eq!(key.version, 1);
    }

    #[test]
    fn invalid_keys_are_refused_without_a_plaintext_fallback() {
        assert!(messaging_key(Some("short".into()), None, true).is_err());
        let value = STANDARD.encode([1u8; 32]);
        assert!(messaging_key(Some(value.clone()), Some("0".into()), true).is_err());
        assert!(messaging_key(None, Some("2".into()), true).is_err());
        assert!(messaging_key(None, None, true).unwrap().is_none());
        assert!(messaging_key(None, None, false).is_err());
    }
}
