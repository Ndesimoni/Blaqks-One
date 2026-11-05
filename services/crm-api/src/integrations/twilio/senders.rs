//! Twilio's WhatsApp senders as the CRM keeps them (design §3): one canonical E.164 phone
//! each, made by the Inbox's single phone normaliser so a number has one key everywhere
//! (W-M5). Twilio's status passes through only as an upper-case word.
use super::{api::Sender, shape};

/// The status that lets a number be given to a member (design §4).
pub const ONLINE: &str = "ONLINE";

pub struct Listed {
    pub phone: String,
    pub status: String,
    pub sender_sid: Option<String>,
}

/// `+` and 8–15 digits, never starting with 0, from any form the Inbox accepts.
pub fn e164(value: &str) -> Option<String> {
    crate::inbox::normalize::phone(value)
        .filter(|digits| !digits.starts_with('0'))
        .map(|digits| format!("+{digits}"))
}

fn status(value: &str) -> String {
    let word = (1..=40).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_uppercase() || byte == b'_' || byte == b':');
    if word {
        value.to_owned()
    } else {
        "UNKNOWN".into()
    }
}

/// Only `whatsapp:+…` senders are kept, each phone once (the first Twilio lists).
pub fn canonical(senders: Vec<Sender>) -> Vec<Listed> {
    let mut listed: Vec<Listed> = Vec::new();
    for sender in senders {
        let Some(number) = sender.sender_id.strip_prefix("whatsapp:+") else {
            continue;
        };
        let Some(phone) = e164(&format!("+{number}")) else {
            continue;
        };
        if listed.iter().any(|known| known.phone == phone) {
            continue;
        }
        listed.push(Listed {
            phone,
            status: status(&sender.status),
            sender_sid: shape::sender_sid(&sender.sid),
        });
    }
    listed
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sender(id: &str, status: &str) -> Sender {
        Sender {
            sid: format!("XE{}", "a".repeat(32)),
            status: status.into(),
            sender_id: id.into(),
        }
    }

    #[test]
    fn senders_become_canonical_phones_once_each() {
        let listed = canonical(vec![
            sender("whatsapp:+99950001001", "ONLINE"),
            sender("whatsapp:+999 5000 1001", "OFFLINE"),
            sender("whatsapp:+99950001002", "offline <b>"),
            sender("sms:+99950001003", "ONLINE"),
            sender("whatsapp:0501234567", "ONLINE"),
            sender("whatsapp:+12", "ONLINE"),
        ]);
        let phones: Vec<&str> = listed.iter().map(|row| row.phone.as_str()).collect();
        assert_eq!(phones, ["+99950001001", "+99950001002"]);
        assert_eq!(listed[0].status, ONLINE);
        assert_eq!(listed[1].status, "UNKNOWN");
        assert!(listed[0].sender_sid.is_some());
    }

    #[test]
    fn typed_phones_use_the_inbox_normaliser() {
        assert_eq!(e164("+999 5000-1001").as_deref(), Some("+99950001001"));
        assert_eq!(
            e164("whatsapp:+99950001001").as_deref(),
            Some("+99950001001")
        );
        assert_eq!(e164("050 123 4567").as_deref(), Some("+971501234567"));
        assert_eq!(e164("+0123456789"), None);
        assert_eq!(e164("not a phone"), None);
    }
}
