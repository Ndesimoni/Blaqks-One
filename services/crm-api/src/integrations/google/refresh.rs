//! Refreshing a mailbox's access token (E1b). Only Google's `invalid_grant` means the
//! grant is gone; everything else is temporary (security review E1b L2).
use super::oauth::{bounded, client, read, Failure, Grant};
use crate::config::google_settings::GoogleConfig;
use serde::Deserialize;

#[derive(Deserialize)]
struct TokenError {
    error: String,
}

/// A short-lived access token from the sealed refresh token. `Refused` means the person
/// or their Workspace revoked access, so the mailbox needs reconnecting.
pub async fn refresh(config: &GoogleConfig, refresh_token: &str) -> Result<String, Failure> {
    let sent = client()
        .post(&config.token_url)
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", &config.client_id),
            ("client_secret", &config.client_secret),
        ])
        .send()
        .await;
    // Only `invalid_grant` means the person or Workspace revoked access. A rate limit, an
    // outage or a client misconfiguration is temporary and must not disconnect every
    // mailbox (security review E1b L2).
    let response = sent.map_err(|_| Failure::Unavailable)?;
    if response.status() == reqwest::StatusCode::BAD_REQUEST {
        let body = bounded(response, 4096).await?;
        let error = serde_json::from_slice::<TokenError>(&body).map(|value| value.error);
        return Err(match error.as_deref() {
            Ok("invalid_grant") => Failure::Refused,
            _ => Failure::Unavailable,
        });
    }
    if !response.status().is_success() {
        return Err(Failure::Unavailable);
    }
    read::<Grant>(Ok(response))
        .await
        .map(|grant| grant.access_token)
}
