//! Turns a returned code into a proven mailbox: exchange with the PKCE verifier, require
//! both mail scopes and a refresh token, then read the address the token controls (SEC-1)
//! and check the Workspace domain. No token is revoked on refusal: revoking ends the
//! person's whole grant, which may serve a connection that already exists.
use super::{oauth, pkce};
use crate::{config::google_settings::GoogleConfig, error::ApiError};
use axum::http::StatusCode;

pub const START_AGAIN: &str = "Google did not confirm the sign-in. Start again.";
pub const SCOPES: &str = "Allow the CRM to send and read your email, then try again.";
pub const DOMAIN: &str = "Connect a mailbox on your company's Google Workspace.";
const UNAVAILABLE: &str = "Google could not be reached. Try again in a moment.";

pub struct Proven {
    pub address: String,
    pub refresh_token: String,
}

fn failed(failure: oauth::Failure) -> ApiError {
    match failure {
        oauth::Failure::Refused => ApiError::invalid(START_AGAIN),
        oauth::Failure::Unavailable => ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            UNAVAILABLE,
            "google_unavailable",
        ),
    }
}

pub async fn prove(config: &GoogleConfig, code: &str, verifier: &str) -> Result<Proven, ApiError> {
    let grant = oauth::exchange(config, code, verifier)
        .await
        .map_err(failed)?;
    if !pkce::granted_both(&grant.scope) {
        return Err(ApiError::invalid(SCOPES));
    }
    let refresh_token = grant
        .refresh_token
        .filter(|token| !token.is_empty() && token.len() <= 2048)
        .ok_or(ApiError::invalid(START_AGAIN))?;
    let address = oauth::mailbox(config, &grant.access_token)
        .await
        .map_err(failed)?;
    if !oauth::on_domain(config, &address) {
        return Err(ApiError::invalid(DOMAIN));
    }
    Ok(Proven {
        address,
        refresh_token,
    })
}

/// A returned `state` or `code`: printable ASCII without spaces, bounded.
pub fn token_shaped(value: &str, max: usize) -> bool {
    !value.is_empty()
        && value.len() <= max
        && value
            .bytes()
            .all(|byte| byte.is_ascii_graphic() && !matches!(byte, b'"' | b'<' | b'>' | b'\\'))
}

#[cfg(test)]
mod tests {
    use super::token_shaped;

    #[test]
    fn returned_values_are_bounded_and_plain() {
        assert!(token_shaped("4/0AX4XfWh-abc_def", 512));
        assert!(!token_shaped("", 512));
        assert!(!token_shaped("has space", 512));
        assert!(!token_shaped("<script>", 512));
        assert!(!token_shaped(&"a".repeat(513), 512));
    }
}
