//! Google's token, profile and revoke endpoints. Short timeouts, no redirects and bounded
//! responses; results are fixed outcomes, never provider text, so no token or address
//! reaches a log or an error message (design §8–§9).
use crate::config::google_settings::GoogleConfig;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use std::{sync::OnceLock, time::Duration};

const MAX_RESPONSE_BYTES: usize = 64 * 1024;

#[derive(Debug, PartialEq)]
pub enum Failure {
    /// Google answered and said no: a bad code, a revoked grant or a refused token.
    Refused,
    /// Timeout, network error or a server error; nothing is known yet.
    Unavailable,
    /// An answer too large or unreadable to use; asking again gives the same (E1c H2).
    Invalid,
}

#[derive(Deserialize)]
pub struct Grant {
    pub access_token: String,
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub scope: String,
}

#[derive(Deserialize)]
struct Profile {
    #[serde(rename = "emailAddress")]
    email_address: String,
    #[serde(rename = "historyId")]
    history_id: Option<String>,
}

pub fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .connect_timeout(Duration::from_secs(3))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("Google HTTP client starts")
    })
}

/// Reads a bounded JSON answer: 4xx is `Refused`, anything unreadable is `Unavailable`.
pub async fn read<T: DeserializeOwned>(
    sent: Result<reqwest::Response, reqwest::Error>,
) -> Result<T, Failure> {
    let response = sent.map_err(|_| Failure::Unavailable)?;
    let status = response.status();
    if status.is_client_error() {
        return Err(Failure::Refused);
    }
    if !status.is_success() {
        return Err(Failure::Unavailable);
    }
    serde_json::from_slice(&bounded(response, MAX_RESPONSE_BYTES).await?)
        .map_err(|_| Failure::Unavailable)
}

/// The body in chunks, so one without a length can never grow past the limit (L1).
pub(in crate::integrations) async fn bounded(
    mut response: reqwest::Response,
    max: usize,
) -> Result<Vec<u8>, Failure> {
    if response
        .content_length()
        .is_some_and(|length| length > max as u64)
    {
        return Err(Failure::Invalid);
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| Failure::Unavailable)? {
        if body.len() + chunk.len() > max {
            return Err(Failure::Invalid);
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

/// Exchanges a one-time code, proving the request with its PKCE verifier.
pub async fn exchange(config: &GoogleConfig, code: &str, verifier: &str) -> Result<Grant, Failure> {
    let sent = client()
        .post(&config.token_url)
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("code_verifier", verifier),
            ("client_id", &config.client_id),
            ("client_secret", &config.client_secret),
            ("redirect_uri", &config.redirect_uri),
        ])
        .send()
        .await;
    read(sent).await
}

/// The mailbox address Google says the token controls, lower-cased (SEC-1), and its
/// current history ID: replies are read from this moment on (E1c).
pub async fn mailbox(
    config: &GoogleConfig,
    access_token: &str,
) -> Result<(String, Option<String>), Failure> {
    let sent = client()
        .get(format!("{}/gmail/v1/users/me/profile", config.gmail_url))
        .bearer_auth(access_token)
        .send()
        .await;
    let profile: Profile = read(sent).await?;
    let address = profile.email_address.trim().to_ascii_lowercase();
    let valid = address.len() <= 160
        && address.split_once('@').is_some_and(|(local, host)| {
            !local.is_empty() && host.contains('.') && !address.contains(char::is_whitespace)
        });
    let cursor = profile
        .history_id
        .filter(|id| (1..=30).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_digit()));
    valid
        .then_some((address, cursor))
        .ok_or(Failure::Unavailable)
}

/// Whether Google no longer honours the token: revoked now, or already invalid (400).
/// Callers queue it first, so a `false` is retried and never blocks a disconnect.
pub async fn revoke(config: &GoogleConfig, token: &str) -> bool {
    let sent = client()
        .post(&config.revoke_url)
        .form(&[("token", token)])
        .send()
        .await;
    sent.is_ok_and(|response| {
        response.status().is_success() || response.status() == reqwest::StatusCode::BAD_REQUEST
    })
}

/// Only addresses on the company's Workspace domain may connect, when one is set.
pub fn on_domain(config: &GoogleConfig, address: &str) -> bool {
    config.domain.as_deref().is_none_or(|domain| {
        address
            .rsplit_once('@')
            .is_some_and(|(_, host)| host == domain)
    })
}
