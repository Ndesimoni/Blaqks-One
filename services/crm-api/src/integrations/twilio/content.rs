//! Twilio's content templates with their WhatsApp approvals (design §8):
//! `GET https://content.twilio.com/v1/ContentAndApprovals`, at most ten pages of 50.
use super::{
    pages::{large, same_page, MAX_PAGES},
    templates::Content,
};
use crate::{
    config::twilio_settings::TwilioConfig,
    integrations::google::oauth::{client, Failure},
};
use serde::Deserialize;

const LIST: &str = "/v1/ContentAndApprovals";

#[derive(Deserialize)]
struct Page {
    #[serde(default)]
    contents: Vec<Content>,
    #[serde(default)]
    meta: Meta,
}

#[derive(Default, Deserialize)]
struct Meta {
    next_page_url: Option<String>,
}

/// The templates, and whether the list was read to its end (so templates missing from it
/// may be forgotten).
pub async fn list(
    config: &TwilioConfig,
    sid: &str,
    token: &str,
) -> Result<(Vec<Content>, bool), Failure> {
    let mut url = Some(format!("{}{LIST}?PageSize=50", config.content_url));
    let mut found = Vec::new();
    for _ in 0..MAX_PAGES {
        let Some(next) = url.take() else {
            break;
        };
        let sent = client().get(next).basic_auth(sid, Some(token)).send().await;
        let page: Page = large(sent).await?;
        found.extend(page.contents);
        url = match page.meta.next_page_url.filter(|next| !next.is_empty()) {
            Some(next) if same_page(&config.content_url, LIST, &next) => Some(next),
            Some(_) => return Err(Failure::Invalid),
            None => None,
        };
    }
    Ok((found, url.is_none()))
}

#[cfg(test)]
mod tests {
    use super::{same_page, LIST};
    use crate::config::twilio_settings::twilio_config;

    #[test]
    fn next_page_links_stay_on_the_template_list() {
        let real = twilio_config(None, false).unwrap();
        let base = &real.content_url;
        assert!(same_page(
            base,
            LIST,
            "https://content.twilio.com/v1/ContentAndApprovals?PageSize=50&Page=1"
        ));
        for refused in [
            "https://content.twilio.com/v1/Content?Page=1",
            "https://api.twilio.com/v1/ContentAndApprovals?Page=1",
            "https://u:p@content.twilio.com/v1/ContentAndApprovals",
        ] {
            assert!(!same_page(base, LIST, refused), "{refused}");
        }
    }
}
