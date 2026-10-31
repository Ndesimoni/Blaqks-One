//! Opaque keyset cursors: base64url (no padding) of the big-endian `created_at`
//! microseconds followed by the row UUID. They carry no workspace, so a cursor replayed
//! against another workspace only bounds that workspace's own rows.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use uuid::Uuid;

const LENGTH: usize = 24;

pub fn encode((micros, id): (i64, Uuid)) -> String {
    let mut bytes = Vec::with_capacity(LENGTH);
    bytes.extend_from_slice(&micros.to_be_bytes());
    bytes.extend_from_slice(id.as_bytes());
    URL_SAFE_NO_PAD.encode(bytes)
}

/// The decoded position, or `None` for any malformed or negative cursor.
pub fn decode(value: &str) -> Option<(i64, Uuid)> {
    let bytes = URL_SAFE_NO_PAD.decode(value).ok()?;
    if bytes.len() != LENGTH {
        return None;
    }
    let micros = i64::from_be_bytes(bytes[..8].try_into().ok()?);
    let id = Uuid::from_slice(&bytes[8..]).ok()?;
    (micros >= 0).then_some((micros, id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cursors_round_trip_and_refuse_anything_else() {
        let position = (1_760_000_000_123_456, Uuid::new_v4());
        let cursor = encode(position);
        assert_eq!(cursor.len(), 32);
        assert!(!cursor.contains('=') && !cursor.contains('+') && !cursor.contains('/'));
        assert_eq!(decode(&cursor), Some(position));
        for bad in [
            "",
            "abc",
            "not a cursor",
            &cursor[..31],
            &format!("{cursor}AA"),
        ] {
            assert_eq!(decode(bad), None, "{bad}");
        }
        assert_eq!(decode(&encode((-1, Uuid::nil()))), None);
    }
}
