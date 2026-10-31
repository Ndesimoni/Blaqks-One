//! What a Twilio answer means (W1a security review L1). Only 401 says Twilio refused the
//! token, so only it may mark the company account for reconnecting; a rate limit or server
//! error is temporary, and any other 4xx (WhatsApp senders not enabled, an unknown resource)
//! leaves a healthy account as it is.
use crate::integrations::google::oauth::Failure;
use reqwest::StatusCode;

/// `None` for success.
pub fn failure(status: StatusCode) -> Option<Failure> {
    if status.is_success() {
        None
    } else if status == StatusCode::UNAUTHORIZED {
        Some(Failure::Refused)
    } else if status == StatusCode::TOO_MANY_REQUESTS || !status.is_client_error() {
        Some(Failure::Unavailable)
    } else {
        Some(Failure::Invalid)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_refused_token_asks_for_reconnecting() {
        let code = |n| failure(StatusCode::from_u16(n).unwrap());
        assert!(code(200).is_none());
        assert!(matches!(code(401), Some(Failure::Refused)));
        assert!(matches!(code(429), Some(Failure::Unavailable)));
        assert!(matches!(code(503), Some(Failure::Unavailable)));
        assert!(matches!(code(403), Some(Failure::Invalid)));
        assert!(matches!(code(404), Some(Failure::Invalid)));
    }
}
