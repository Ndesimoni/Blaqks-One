//! The provider-neutral inbound message the Inbox receives, and the local stub's format.
//! Each real adapter (W2, E1, S1, T1) parses its own payload into [`Inbound`]; the Inbox
//! never sees provider JSON.
use serde_json::{Map, Value};

/// Where a first message came from, when the provider says so (design §6 lead rules).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Source {
    Ad,
    Listing,
    Form,
    Portal,
}

impl Source {
    pub fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "ad" => Self::Ad,
            "listing" => Self::Listing,
            "form" => Self::Form,
            "portal" => Self::Portal,
            _ => return None,
        })
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ad => "ad",
            Self::Listing => "listing",
            Self::Form => "form",
            Self::Portal => "portal",
        }
    }
}

/// One inbound message. `from` is the sender's phone, email or platform user ID as the
/// provider gives it; the Inbox normalises it.
#[derive(Clone, Debug, PartialEq)]
pub struct Inbound {
    pub thread_id: String,
    pub message_id: String,
    pub from: String,
    pub name: Option<String>,
    pub text: String,
    pub has_media: bool,
    pub source: Option<Source>,
    /// The CRM Property ID of the advertised listing, for routing to its agent.
    pub listing: Option<String>,
}

const KEYS: [&str; 8] = [
    "thread", "message", "from", "name", "text", "media", "source", "listing",
];

fn text(map: &Map<String, Value>, key: &str, max: usize) -> Result<Option<String>, &'static str> {
    match map.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(value)) if value.chars().count() <= max => {
            Ok(Some(value.trim().to_owned()).filter(|value| !value.is_empty()))
        }
        Some(_) => Err("unparseable"),
    }
}

/// The stub's JSON: `thread`, `message`, `from` and `text` are required; `name`, `media`,
/// `source` and `listing` are optional. Unknown keys or wrong types are refused.
pub fn parse_stub(body: &[u8]) -> Result<Inbound, &'static str> {
    let Ok(Value::Object(map)) = serde_json::from_slice::<Value>(body) else {
        return Err("unparseable");
    };
    if map.keys().any(|key| !KEYS.contains(&key.as_str())) {
        return Err("unparseable");
    }
    let required = |key, max| text(&map, key, max)?.ok_or("unparseable");
    let source = match text(&map, "source", 20)? {
        Some(value) => Some(Source::parse(&value).ok_or("unparseable")?),
        None => None,
    };
    let has_media = match map.get("media") {
        None | Some(Value::Null) => false,
        Some(Value::Bool(value)) => *value,
        Some(_) => return Err("unparseable"),
    };
    Ok(Inbound {
        thread_id: required("thread", 200)?,
        message_id: required("message", 200)?,
        from: required("from", 320)?,
        name: text(&map, "name", 120)?,
        text: text(&map, "text", 20_000)?.unwrap_or_default(),
        has_media,
        source,
        listing: text(&map, "listing", 40)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_stub_format_is_strict() {
        let body = br#"{"thread":"t1","message":"m1","from":"+971 50 000 0001",
            "name":" Synthetic ","text":"Hello","source":"ad","listing":"PR-0001"}"#;
        let message = parse_stub(body).unwrap();
        assert_eq!(message.name.as_deref(), Some("Synthetic"));
        assert_eq!(message.source, Some(Source::Ad));
        assert!(!message.has_media);
        assert!(parse_stub(br#"{"thread":"t1","message":"m1","from":"x"}"#).is_ok());
        for bad in [
            &br#"{"thread":"t1","message":"m1"}"#[..],
            br#"{"thread":"t1","message":"m1","from":"x","extra":1}"#,
            br#"{"thread":"t1","message":"m1","from":"x","source":"tv"}"#,
            br#"{"thread":1,"message":"m1","from":"x"}"#,
            b"[]",
            b"not json",
        ] {
            assert!(parse_stub(bad).is_err());
        }
    }
}
