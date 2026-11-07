use super::bot::{BotCheck, Outcome};
use crate::config::TurnstileConfig;
use serde_json::Value;
use std::{future::Future, pin::Pin, sync::Arc, time::Duration};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

const MAX_RESPONSE_BYTES: usize = 64 * 1024;
const MAX_AGE_SECONDS: i64 = 300;
const CONCURRENCY: usize = 4;

/// Cloudflare Turnstile Siteverify (packet R2). Fixed endpoint, short timeout, bounded
/// response and bounded concurrency. Any timeout, provider failure or malformed body fails
/// closed as `Unavailable`; a well-formed refusal is `Fail`.
pub struct Turnstile {
    secret: String,
    hostname: String,
    endpoint: String,
    site_key: String,
    client: reqwest::Client,
    permits: Arc<tokio::sync::Semaphore>,
}

impl Turnstile {
    pub fn new(config: &TurnstileConfig) -> Result<Self, String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .connect_timeout(Duration::from_secs(2))
            .build()
            .map_err(|_| "Turnstile HTTP client could not start.")?;
        Ok(Self {
            secret: config.secret.clone(),
            hostname: config.hostname.clone(),
            endpoint: config.endpoint.clone(),
            site_key: config.site_key.clone(),
            client,
            permits: Arc::new(tokio::sync::Semaphore::new(CONCURRENCY)),
        })
    }

    async fn check(&self, token: &str, action: &str) -> Outcome {
        let Ok(_permit) = self.permits.acquire().await else {
            return Outcome::Unavailable;
        };
        let response = self
            .client
            .post(&self.endpoint)
            .form(&[("secret", self.secret.as_str()), ("response", token)])
            .send()
            .await;
        let Ok(response) = response else {
            return Outcome::Unavailable;
        };
        if !response.status().is_success()
            || response
                .content_length()
                .is_some_and(|length| length > MAX_RESPONSE_BYTES as u64)
        {
            return Outcome::Unavailable;
        }
        let Ok(body) = response.bytes().await else {
            return Outcome::Unavailable;
        };
        if body.len() > MAX_RESPONSE_BYTES {
            return Outcome::Unavailable;
        }
        let Ok(value) = serde_json::from_slice::<Value>(&body) else {
            return Outcome::Unavailable;
        };
        if value.get("success") != Some(&Value::Bool(true)) {
            return Outcome::Fail;
        }
        if value.get("action").and_then(Value::as_str) != Some(action)
            || value.get("hostname").and_then(Value::as_str) != Some(self.hostname.as_str())
        {
            return Outcome::Fail;
        }
        let Some(stamp) = value.get("challenge_ts").and_then(Value::as_str) else {
            return Outcome::Fail;
        };
        let Ok(at) = OffsetDateTime::parse(stamp, &Rfc3339) else {
            return Outcome::Fail;
        };
        let age = (OffsetDateTime::now_utc() - at).whole_seconds();
        if (0..=MAX_AGE_SECONDS).contains(&age) {
            Outcome::Pass
        } else {
            Outcome::Fail
        }
    }
}

impl BotCheck for Turnstile {
    fn provider(&self) -> &'static str {
        "turnstile"
    }

    fn site_key(&self) -> Option<&str> {
        Some(&self.site_key)
    }

    fn verify<'a>(
        &'a self,
        token: &'a str,
        action: &'a str,
    ) -> Pin<Box<dyn Future<Output = Outcome> + Send + 'a>> {
        Box::pin(async move { self.check(token, action).await })
    }
}

#[cfg(test)]
#[path = "turnstile_tests.rs"]
mod tests;
