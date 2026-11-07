//! The policy for every new password (account-self-service.md, Password policy): password
//! change, invitation activation and the account command line. Existing passwords keep
//! working until changed. The browser mirrors these rules in `src/lib/passwordPolicy.js`.
use crate::error::{ApiError, ApiResult};
use axum::http::StatusCode;

pub const WEAK_PASSWORD: &str = "Use at least 8 characters with an uppercase letter, a lowercase \
                                 letter, a number and a special character.";

pub fn weak() -> ApiError {
    ApiError(StatusCode::BAD_REQUEST, WEAK_PASSWORD, "weak_password")
}

/// The character rules and the byte cap: at least 8 characters with an uppercase letter,
/// a lowercase letter, a number and a special character (neither a letter nor a number),
/// and at most 1024 bytes.
pub fn strong(password: &str) -> bool {
    password.chars().count() >= 8
        && password.len() <= 1024
        && password.chars().any(char::is_uppercase)
        && password.chars().any(char::is_lowercase)
        && password.chars().any(char::is_numeric)
        && password
            .chars()
            .any(|character| !character.is_alphanumeric())
}

/// The full check: the rules, different from the current password (when one is given)
/// and different from the account email, ignoring case and surrounding spaces.
pub fn check(password: &str, current: Option<&str>, email: &str) -> ApiResult<()> {
    let is_email = password.trim().to_lowercase() == email.trim().to_lowercase();
    if !strong(password) || current == Some(password) || is_email {
        return Err(weak());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_character_rule_is_required() {
        assert!(strong("Synth3tic!"));
        for weak_value in [
            "Sh0rt!",
            "synth3tic!",
            "SYNTH3TIC!",
            "Synthetic!",
            "Synth3tic9",
        ] {
            assert!(!strong(weak_value), "{weak_value}");
        }
        assert!(strong("Pass 1word"));
        assert!(strong("Éclair9#x"));
    }

    #[test]
    fn length_counts_characters_and_caps_bytes() {
        assert!(!strong("Aa1!aaa"));
        assert!(strong("Aa1!aaaa"));
        let long = format!("Aa1!{}", "a".repeat(1020));
        assert_eq!(long.len(), 1024);
        assert!(strong(&long));
        assert!(!strong(&format!("{long}a")));
        assert!(!strong(&format!("Aa1!{}", "é".repeat(511))));
    }

    #[test]
    fn rejects_the_current_password_and_the_email() {
        let email = "synthetic.member1@example.test";
        assert!(check("Synth3tic!", None, email).is_ok());
        let error = check("Synth3tic!", Some("Synth3tic!"), email).unwrap_err();
        assert_eq!(
            (error.0, error.2),
            (StatusCode::BAD_REQUEST, "weak_password")
        );
        assert!(check("Synth3tic!", Some("Other3tic!"), email).is_ok());
        assert!(strong("Synthetic.Member1@Example.test"));
        assert!(check("Synthetic.Member1@Example.test", None, email).is_err());
        assert!(check(" Synthetic.Member1@Example.test ", None, email).is_err());
        assert!(check("Synthetic.Member2@Example.test", None, email).is_ok());
    }
}
