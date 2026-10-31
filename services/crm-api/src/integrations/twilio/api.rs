//! Twilio's account read and WhatsApp-sender list (W1a, design §4 and §16), with the
//! hardened client the Google and SendGrid adapters share: a 10-second timeout, a 3-second
//! connect timeout, no redirects and bounded bodies. Results are fixed outcomes, never
//! Twilio's text, so no token or provider message reaches a log or a response. Callers
//! check the SID and token shapes first, so neither can alter a URL.
use crate::{
    config::twilio_settings::TwilioConfig,
    integrations::google::oauth::{bounded, client, read, Failure},
};
use serde::{de::DeserializeOwned, Deserialize};

/// Design §4: at most ten pages of senders are read.
pub const MAX_PAGES: usize = 10;
/// A page of 50 senders with their profiles fits well inside this.
const MAX_PAGE_BYTES: usize = 512 * 1024;
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
    read(sent).await
}

/// The account's WhatsApp senders, following Twilio's next-page links for at most
/// `MAX_PAGES` pages. A link that leaves the senders list is refused, so the token is
/// never sent anywhere else.
pub async fn senders(
    config: &TwilioConfig,
    sid: &str,
    token: &str,
) -> Result<Vec<Sender>, Failure> {
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
    Ok(found)
}

/// Whether `next` is another page of this host's senders list.
pub fn same_list(config: &TwilioConfig, next: &str) -> bool {
    let (Ok(next), Ok(base)) = (
        url::Url::parse(next),
        url::Url::parse(&config.messaging_url),
    ) else {
        return false;
    };
    next.origin() == base.origin()
        && next.path() == SENDERS
        && next.username().is_empty()
        && next.password().is_none()
        && next.fragment().is_none()
}

/// As `oauth::read`, with room for a full page: 4xx is `Refused`, anything else unusable
/// is `Unavailable`.
async fn large<T: DeserializeOwned>(
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
    serde_json::from_slice(&bounded(response, MAX_PAGE_BYTES).await?)
        .map_err(|_| Failure::Unavailable)
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
