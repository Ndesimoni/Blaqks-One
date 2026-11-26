//! Twilio's answers as the CRM's fixed words (design §5 and §11). A refused send or a
//! failed callback carries an error code, which becomes one plain reason; Twilio's own
//! text is never kept. A callback's `MessageStatus` maps to the Inbox's statuses.

/// The member's number is not a WhatsApp sender of this account (§11, carried L3).
pub const NOT_SET_UP: &str = "number_not_set_up";

/// The reason shown to staff for a Twilio error code (§11).
pub fn reason(code: Option<i64>) -> &'static str {
    match code {
        Some(63016) => "outside_window",
        Some(63003 | 63024 | 21211) => "not_on_whatsapp",
        Some(63018 | 20429) => "whatsapp_limited",
        Some(63049) => "template_not_delivered",
        Some(21606 | 63007) => NOT_SET_UP,
        _ => "whatsapp_refused",
    }
}

/// A status Twilio reports for a sent message, as the Inbox stores it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Sent,
    Delivered,
    Read,
    Failed,
}

impl Status {
    /// Twilio's `MessageStatus`; queued, accepted, sending and the rest change nothing.
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "sent" => Some(Self::Sent),
            "delivered" => Some(Self::Delivered),
            "read" => Some(Self::Read),
            "undelivered" | "failed" => Some(Self::Failed),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Sent => "sent",
            Self::Delivered => "delivered",
            Self::Read => "read",
            Self::Failed => "failed",
        }
    }
}

/// `ErrorCode` as Twilio writes it: 1–6 digits.
pub fn error_code(value: Option<&str>) -> Option<i64> {
    value
        .filter(|text| (1..=6).contains(&text.len()) && text.bytes().all(|b| b.is_ascii_digit()))
        .and_then(|text| text.parse().ok())
}

/// A message ID Twilio returns or reports: `SM` (or `MM` with media) and 32 hex digits.
pub fn message_sid(value: &str) -> bool {
    let hex = |rest: &str| {
        rest.len() == 32
            && rest
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    };
    value.strip_prefix("SM").is_some_and(hex) || value.strip_prefix("MM").is_some_and(hex)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_codes_become_the_reasons_of_section_eleven() {
        assert_eq!(reason(Some(63016)), "outside_window");
        for code in [63003, 63024, 21211] {
            assert_eq!(reason(Some(code)), "not_on_whatsapp");
        }
        assert_eq!(reason(Some(63018)), "whatsapp_limited");
        assert_eq!(reason(Some(20429)), "whatsapp_limited");
        assert_eq!(reason(Some(63049)), "template_not_delivered");
        assert_eq!(reason(Some(21606)), NOT_SET_UP);
        assert_eq!(reason(Some(63007)), NOT_SET_UP);
        assert_eq!(reason(Some(30008)), "whatsapp_refused");
        assert_eq!(reason(None), "whatsapp_refused");
        assert_eq!(error_code(Some("63016")), Some(63016));
        for refused in [None, Some(""), Some("-1"), Some("1234567"), Some("63 16")] {
            assert_eq!(error_code(refused), None);
        }
    }

    #[test]
    fn callback_statuses_map_to_the_inbox_and_others_change_nothing() {
        assert_eq!(Status::parse("sent"), Some(Status::Sent));
        assert_eq!(Status::parse("delivered"), Some(Status::Delivered));
        assert_eq!(Status::parse("read"), Some(Status::Read));
        assert_eq!(Status::parse("undelivered"), Some(Status::Failed));
        assert_eq!(Status::parse("failed"), Some(Status::Failed));
        for ignored in [
            "queued",
            "accepted",
            "sending",
            "scheduled",
            "canceled",
            "READ",
            "",
        ] {
            assert_eq!(Status::parse(ignored), None, "{ignored}");
        }
        assert!(message_sid(&format!("SM{}", "a1".repeat(16))));
        assert!(message_sid(&format!("MM{}", "0".repeat(32))));
        assert!(!message_sid(&format!("SM{}", "A".repeat(32))));
        assert!(!message_sid(&format!("XE{}", "0".repeat(32))));
        assert!(!message_sid("SM123"));
    }
}
