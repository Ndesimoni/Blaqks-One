//! Twilio's account read and WhatsApp-sender list (W1a, design §4 and §16), with the
//! hardened client the Google and SendGrid adapters share: a 10-second timeout, a 3-second
//! connect timeout, no redirects and bounded bodies. Results are fixed outcomes, never
//! Twilio's text, so no token or provider message reaches a log or a response. Callers
//! check the SID and token shapes first, so neither can alter a URL.
use super::pages::{large, MAX_PAGES};
use crate::{
    config::twilio_settings::TwilioConfig,
    integrations::google::oauth::{client, Failure},
};
use serde::Deserialize;

const SENDERS: &str = "/v2/Channels/Senders";

#[derive(Deserialize)]
pub struct Account {
    pub sid: String,
    pub status: String,
}

#[derive(Deserialize)]
pub struct Sender {
    #[serde(default)]
    pub sid: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub sender_id: String,
}

#[derive(Deserialize)]
struct Page {
    #[serde(default)]
    senders: Vec<Sender>,
    #[serde(default)]
    meta: Meta,
}

#[derive(Default, Deserialize)]
struct Meta {
    next_page_url: Option<String>,
}

/// `GET /2010-04-01/Accounts/{sid}.json`, authenticated as that account.
pub async fn account(config: &TwilioConfig, sid: &str, token: &str) -> Result<Account, Failure> {
    let sent = client()
        .get(format!("{}/2010-04-01/Accounts/{sid}.json", config.api_url))
        .basic_auth(sid, Some(token))
        .send()
        .await;
    large(sent).await
}

/// The account's WhatsApp senders, following Twilio's next-page links for at most
/// `MAX_PAGES` pages, and whether the list was read to its end. A link that leaves the
/// senders list is refused, so the token is never sent anywhere else.
pub async fn senders(
    config: &TwilioConfig,
    sid: &str,
    token: &str,
) -> Result<(Vec<Sender>, bool), Failure> {
    let mut url = Some(format!(
        "{}{SENDERS}?Channel=whatsapp&PageSize=50",
        config.messaging_url
    ));
    let mut found = Vec::new();
    for _ in 0..MAX_PAGES {
        let Some(next) = url.take() else {
            break;
        };
        let sent = client().get(next).basic_auth(sid, Some(token)).send().await;
        let page: Page = large(sent).await?;
        found.extend(page.senders);
        url = match page.meta.next_page_url.filter(|next| !next.is_empty()) {
            Some(next) if same_list(config, &next) => Some(next),
            Some(_) => return Err(Failure::Invalid),
            None => None,
        };
    }
    Ok((found, url.is_none()))
}

/// Whether `next` is another page of this host's senders list.
pub fn same_list(config: &TwilioConfig, next: &str) -> bool {
    super::pages::same_page(&config.messaging_url, SENDERS, next)
}

#[cfg(test)]
mod tests {
    use super::same_list;
    use crate::config::twilio_settings::twilio_config;

    #[test]
    fn next_page_links_stay_on_the_senders_list() {
        let real = twilio_config(None, false).unwrap();
        let page = "https://messaging.twilio.com/v2/Channels/Senders?PageSize=50&Page=1";
        assert!(same_list(&real, page));
        for refused in [
            "https://evil.example/v2/Channels/Senders?Page=1",
            "http://messaging.twilio.com/v2/Channels/Senders?Page=1",
            "https://messaging.twilio.com/v2/Services?Page=1",
            "https://user@messaging.twilio.com/v2/Channels/Senders",
            "https://messaging.twilio.com/v2/Channels/Senders#x",
            "/v2/Channels/Senders?Page=1",
        ] {
            assert!(!same_list(&real, refused), "{refused}");
        }
        let local = twilio_config(Some("http://127.0.0.1:8794".into()), true).unwrap();
        assert!(same_list(
            &local,
            "http://127.0.0.1:8794/v2/Channels/Senders?Page=2"
        ));
        assert!(!same_list(
            &local,
            "http://127.0.0.1:9999/v2/Channels/Senders?Page=2"
        ));
    }
}
