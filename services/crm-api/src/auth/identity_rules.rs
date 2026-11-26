//! Name, email and phone rules for every account (account-self-service.md, Module
//! ownership). Auth owns the identity columns, so team invitations, member edits, self-
//! service and the account command line all validate through these functions.
use crate::error::{ApiError, ApiResult};

/// A display name: 1 to 100 characters after trimming.
pub fn name(value: &str) -> bool {
    let trimmed = value.trim();
    !trimmed.is_empty() && trimmed.chars().count() <= 100
}

/// An international (E.164) phone number: `+` then 7 to 15 digits.
pub fn phone(value: &str) -> bool {
    value.starts_with('+')
        && (8..=16).contains(&value.len())
        && value[1..]
            .chars()
            .all(|character| character.is_ascii_digit())
}

/// A sign-in email: one `@`, a dotted host, no whitespace, at most 254 bytes.
pub fn email(value: &str) -> bool {
    let shaped = value.split_once('@').is_some_and(|(local, host)| {
        !local.is_empty() && host.contains('.') && !host.contains('@')
    });
    shaped && value.len() <= 254 && !value.chars().any(char::is_whitespace)
}

pub fn identity(name_value: &str, email_value: &str, number: &str) -> ApiResult<()> {
    if !name(name_value) || !email(email_value) || !phone(number) {
        return Err(ApiError::invalid(
            "Provide a name, valid email and international phone.",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_trimmed_and_counted_in_characters() {
        assert!(!name("   "));
        assert!(name(" Synthetic Member "));
        assert!(name(&"ع".repeat(100)));
        assert!(!name(&"a".repeat(101)));
    }

    #[test]
    fn phones_and_emails_follow_the_shared_shape() {
        assert!(phone("+971501234567"));
        assert!(!phone("971501234567"));
        assert!(!phone("+97150123456789012"));
        assert!(!phone("+9715012x4567"));
        assert!(email("member@example.test"));
        assert!(!email("member@localhost"));
        assert!(!email("mem ber@example.test"));
        assert!(identity("Synthetic", "member@example.test", "+971501234567").is_ok());
        assert!(identity("", "member@example.test", "+971501234567").is_err());
    }
}
