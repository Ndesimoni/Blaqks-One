//! SendGrid's Inbound Parse settings (E3c, design §4 and §14): a signature security policy,
//! the Parse setting for the company domain pointing at the connection's own URL, then the
//! policy attached by an update as SendGrid documents it, and the setting read back: only one
//! proven signed, spam-checked and pointing here counts (preflight review M1). A failure
//! removes both, best effort. An existing setting is never taken over (L7) unless it already
//! posts to this connection's URL, left by an attempt whose answer never came (L1).
use crate::{
    config::sendgrid_settings::SendgridConfig,
    integrations::google::oauth::{client, read, Failure},
};
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
struct Signature {
    public_key: String,
}

#[derive(Deserialize)]
struct Policy {
    id: String,
    signature: Signature,
}

#[derive(Deserialize)]
struct Created {
    policy: Policy,
}

#[derive(Deserialize, Default)]
#[serde(default)]
struct Setting {
    url: String,
    spam_check: bool,
    send_raw: bool,
    security_policy: Option<String>,
}

/// Creates the policy and the signed Parse setting; returns the policy's public key.
pub async fn create(
    config: &SendgridConfig,
    key: &str,
    hostname: &str,
    url: &str,
) -> Result<String, Failure> {
    let sent = client()
        .post(format!("{}{POLICIES}", config.api_url))
        .bearer_auth(key)
        .json(&json!({ "name": "CRM incoming mail", "signature": { "enabled": true } }))
        .send()
        .await;
    let Policy { id, signature } = read::<Created>(sent).await?.policy;
    let mut setting = wanted(url, None);
    setting["hostname"] = json!(hostname);
    let sent = client()
        .post(format!("{}{PARSE}", config.api_url))
        .bearer_auth(key)
        .json(&setting)
        .send()
        .await;
    let made = match read::<Setting>(sent).await {
        // Taken over only when it already posts to this connection (review L7, L1).
        Err(Failure::Refused) => match found(config, key, hostname).await {
            Ok(existing) if existing.url == url => Ok(()),
            Ok(_) => Err(Failure::Refused),
            Err(failure) => Err(failure),
        },
        other => other.map(|_| ()),
    };
    if let Err(failure) = made {
        remove_policy(config, key, &id).await;
        return Err(failure);
    }
    if let Err(failure) = attach(config, key, hostname, url, &id).await {
        delete(config, key, hostname).await;
        remove_policy(config, key, &id).await;
        return Err(failure);
    }
    Ok(signature.public_key)
}

const POLICIES: &str = "/v3/user/webhooks/security/policies";
const PARSE: &str = "/v3/user/webhooks/parse/settings";

/// The fields this connection's setting must have; every update repeats them all.
fn wanted(url: &str, policy: Option<&str>) -> serde_json::Value {
    let mut fields = json!({ "url": url, "spam_check": true, "send_raw": false });
    if let Some(policy) = policy {
        fields["security_policy"] = json!(policy);
    }
    fields
}

/// Attaches the policy, then reads the setting back; an answer is never trusted unseen.
async fn attach(
    config: &SendgridConfig,
    key: &str,
    hostname: &str,
    url: &str,
    policy: &str,
) -> Result<(), Failure> {
    let sent = client()
        .patch(setting_url(config, hostname))
        .bearer_auth(key)
        .json(&wanted(url, Some(policy)))
        .send()
        .await;
    // A 2xx may come without a body.
    let status = sent.map_err(|_| Failure::Unavailable)?.status();
    if status.is_client_error() {
        return Err(Failure::Refused);
    }
    if !status.is_success() {
        return Err(Failure::Unavailable);
    }
    let setting = found(config, key, hostname).await?;
    let signed = setting.security_policy.as_deref() == Some(policy);
    match signed && setting.url == url && setting.spam_check && !setting.send_raw {
        true => Ok(()),
        false => Err(Failure::Invalid),
    }
}

async fn found(config: &SendgridConfig, key: &str, hostname: &str) -> Result<Setting, Failure> {
    let sent = client()
        .get(setting_url(config, hostname))
        .bearer_auth(key)
        .send()
        .await;
    read(sent).await
}

fn setting_url(config: &SendgridConfig, hostname: &str) -> String {
    format!("{}{PARSE}/{hostname}", config.api_url)
}

/// Best effort: an unused policy left behind signs nothing.
async fn remove_policy(config: &SendgridConfig, key: &str, id: &str) {
    let url = format!("{}{POLICIES}/{id}", config.api_url);
    let _ = client().delete(url).bearer_auth(key).send().await;
}

/// Best effort; a setting left behind posts mail the CRM refuses.
pub async fn delete(config: &SendgridConfig, key: &str, hostname: &str) {
    let url = setting_url(config, hostname);
    let _ = client().delete(url).bearer_auth(key).send().await;
}
