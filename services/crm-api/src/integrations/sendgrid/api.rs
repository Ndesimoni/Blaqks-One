//! SendGrid's key-scope and domain-authentication reads (E3a). They use the Google
//! adapter's hardened client and bounded reader: short timeouts, no redirects, responses
//! capped at 64 KiB, and fixed outcomes, so no key or provider text reaches a log.
use super::account::AuthenticatedDomain;
use crate::{
    config::sendgrid_settings::SendgridConfig,
    integrations::google::oauth::{client, read, Failure},
};
use serde::Deserialize;

#[derive(Deserialize)]
struct Scopes {
    scopes: Vec<String>,
}

/// The permissions the key holds (`GET /v3/scopes`).
pub async fn scopes(config: &SendgridConfig, key: &str) -> Result<Vec<String>, Failure> {
    let sent = client()
        .get(format!("{}/v3/scopes", config.api_url))
        .bearer_auth(key)
        .send()
        .await;
    read::<Scopes>(sent).await.map(|found| found.scopes)
}

/// The account's authenticated sending domains (`GET /v3/whitelabel/domains`).
pub async fn domains(
    config: &SendgridConfig,
    key: &str,
) -> Result<Vec<AuthenticatedDomain>, Failure> {
    let sent = client()
        .get(format!("{}/v3/whitelabel/domains", config.api_url))
        .query(&[("limit", "100")])
        .bearer_auth(key)
        .send()
        .await;
    read(sent).await
}
