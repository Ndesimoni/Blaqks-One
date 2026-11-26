//! One page of Twilio's WhatsApp senders list, read strictly (W1b review L1): the `senders`
//! list and `meta` must both be present, and an item without a sender ID, or a WhatsApp
//! sender whose number cannot be read, marks the page unreadable. The worker's recheck
//! disconnects a number only from a complete, readable list.
use super::{api::Sender, senders::e164};

/// One page of Twilio's senders list.
pub struct SendersPage {
    pub senders: Vec<Sender>,
    pub next: Option<String>,
    /// Every item parsed with a sender ID, and every WhatsApp one has a readable number.
    pub readable: bool,
}

#[derive(serde::Deserialize)]
struct Strict {
    senders: Vec<serde_json::Value>,
    meta: Meta,
}

#[derive(serde::Deserialize)]
struct Meta {
    next_page_url: Option<String>,
}

/// A page in Twilio's shape, a `senders` list and `meta` both present, else `None`; an
/// unreadable item is left out and marks the page unreadable (W1b review L1).
pub fn page(value: serde_json::Value) -> Option<SendersPage> {
    let strict: Strict = serde_json::from_value(value).ok()?;
    let mut readable = true;
    let mut senders = Vec::new();
    for item in strict.senders {
        match serde_json::from_value::<Sender>(item) {
            Ok(sender) if !sender.sender_id.is_empty() => {
                let whatsapp = sender.sender_id.strip_prefix("whatsapp:");
                readable &= whatsapp.is_none_or(|number| e164(number).is_some());
                senders.push(sender);
            }
            _ => readable = false,
        }
    }
    let next = strict.meta.next_page_url;
    Some(SendersPage {
        senders,
        next,
        readable,
    })
}

#[cfg(test)]
mod tests {
    use super::page;

    #[test]
    fn only_a_page_in_twilios_shape_with_readable_senders_is_complete() {
        use serde_json::json;
        for broken in [
            json!({}),
            json!({"senders": []}),
            json!({"meta": {}}),
            json!([]),
        ] {
            assert!(page(broken.clone()).is_none(), "{broken}");
        }
        let fine = page(json!({"senders": [{"sender_id": "whatsapp:+99950001001"}], "meta": {}}));
        let fine = fine.unwrap();
        assert!(fine.readable && fine.next.is_none());
        assert_eq!(fine.senders.len(), 1);
        for item in [
            json!({"sid": "XE1", "status": "ONLINE"}),
            json!({"sender_id": ""}),
            json!({"sender_id": 5}),
            json!({"sender_id": "whatsapp:not a phone"}),
            json!("text"),
        ] {
            let listed = page(json!({"senders": [item], "meta": {"next_page_url": null}}));
            assert!(!listed.unwrap().readable, "{item}");
        }
        let sms = page(json!({"senders": [{"sender_id": "sms:+99950001001"}], "meta": {}}));
        assert!(
            sms.unwrap().readable,
            "other channels are ignored, not unreadable"
        );
    }
}
