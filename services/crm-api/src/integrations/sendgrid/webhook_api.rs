//! SendGrid's Event Webhook settings (E3b): create one webhook for the connection's own
//! URL with only the delivery events the Inbox uses, turn signing on and read its public
//! key, and delete it on disconnect. The endpoints and scope names are confirmed in the
//! SendGrid sandbox before real use (design §8); the stand-in follows the same shapes.
use crate::{
    config::sendgrid_settings::SendgridConfig,
    integrations::google::oauth::{client, read, Failure},
};
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
struct Created {
    id: String,
}

#[derive(Deserialize)]
struct Signed {
    public_key: String,
}

/// Returns SendGrid's webhook ID and the base64 public key that verifies its events.
pub async fn create(
    config: &SendgridConfig,
    key: &str,
    url: &str,
) -> Result<(String, String), Failure> {
    let settings = json!({
        "enabled": true,
        "url": url,
        "friendly_name": "CRM delivery updates",
        "delivered": true,
        "bounce": true,
        "dropped": true,
        // Spam reports and unsubscribes wait for the consents table (W1), so their
        // recipient addresses are not requested before they are used (review L3).
        "spam_report": false,
        "unsubscribe": false,
        "group_unsubscribe": false,
        "deferred": false,
        "processed": false,
        "open": false,
        "click": false,
        "group_resubscribe": false,
    });
    let base = format!("{}/v3/user/webhooks/event/settings", config.api_url);
    let sent = client()
        .post(&base)
        .bearer_auth(key)
        .json(&settings)
        .send()
        .await;
    let created: Created = read(sent).await?;
    if !plain(&created.id) {
        return Err(Failure::Invalid);
    }
    let sent = client()
        .patch(format!("{base}/signed/{}", created.id))
        .bearer_auth(key)
        .json(&json!({ "enabled": true }))
        .send()
        .await;
    let signed: Signed = read(sent).await?;
    Ok((created.id, signed.public_key))
}

/// Best effort: a failure leaves a webhook whose events the CRM refuses anyway.
pub async fn delete(config: &SendgridConfig, key: &str, id: &str) {
    if plain(id) {
        let url = format!("{}/v3/user/webhooks/event/settings/{id}", config.api_url);
        let _ = client().delete(url).bearer_auth(key).send().await;
    }
}

fn plain(id: &str) -> bool {
    (1..=100).contains(&id.len())
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}
