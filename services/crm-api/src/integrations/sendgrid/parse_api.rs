//! SendGrid's Inbound Parse settings (E3c, design §4): a signature security policy, then
//! the Parse setting for the company domain pointing at the connection's own URL with the
//! policy attached at creation, so no `update` scope is needed. An existing setting for
//! the domain is never overwritten: SendGrid refuses the create and the CRM reports that
//! incoming mail is not set up (review L7). Shapes are confirmed in the sandbox (§8).
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

#[derive(Deserialize)]
struct Setting {}

/// Creates the policy and the Parse setting; returns the policy's public key.
pub async fn create(
    config: &SendgridConfig,
    key: &str,
    hostname: &str,
    url: &str,
) -> Result<String, Failure> {
    let sent = client()
        .post(format!(
            "{}/v3/user/webhooks/security/policies",
            config.api_url
        ))
        .bearer_auth(key)
        .json(&json!({ "name": "CRM incoming mail", "signature": { "enabled": true } }))
        .send()
        .await;
    let created: Created = read(sent).await?;
    let settings = json!({
        "hostname": hostname,
        "url": url,
        "spam_check": true,
        "send_raw": false,
        "security_policy": created.policy.id,
    });
    let sent = client()
        .post(format!(
            "{}/v3/user/webhooks/parse/settings",
            config.api_url
        ))
        .bearer_auth(key)
        .json(&settings)
        .send()
        .await;
    read::<Setting>(sent).await?;
    Ok(created.policy.signature.public_key)
}

/// Best effort; a setting left behind posts mail the CRM refuses.
pub async fn delete(config: &SendgridConfig, key: &str, hostname: &str) {
    let url = format!(
        "{}/v3/user/webhooks/parse/settings/{hostname}",
        config.api_url
    );
    let _ = client().delete(url).bearer_auth(key).send().await;
}
