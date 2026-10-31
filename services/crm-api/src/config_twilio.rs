//! Twilio settings (WhatsApp packet W1, docs/whatsapp-design.md §9 and §16). Each company
//! connects its own Twilio account with its own Auth Token, so the CRM holds no Twilio
//! secret; only Twilio's hosts are configured. `CRM_TWILIO_ENDPOINT` replaces every host
//! the adapter uses (api, messaging and content) with the local stand-in
//! (`npm run dev:twilio`) in one setting (W-L5), and is accepted in local development
//! alone, for a loopback `http://` origin.
const API: &str = "https://api.twilio.com";
const MESSAGING: &str = "https://messaging.twilio.com";
const CONTENT: &str = "https://content.twilio.com";

/// Each host as `scheme://host[:port]`, without a trailing slash.
#[derive(Clone)]
pub struct TwilioConfig {
    /// Accounts (`/2010-04-01/Accounts`); messages and media in later packets.
    pub api_url: String,
    /// WhatsApp senders (`/v2/Channels/Senders`).
    pub messaging_url: String,
    /// Content templates (`/v1/ContentAndApprovals`, packet W1b).
    pub content_url: String,
}

/// Reads `CRM_TWILIO_ENDPOINT`, the local Twilio stand-in.
pub fn from_env(local: bool) -> Result<TwilioConfig, String> {
    twilio_config(std::env::var("CRM_TWILIO_ENDPOINT").ok(), local)
}

pub fn twilio_config(endpoint: Option<String>, local: bool) -> Result<TwilioConfig, String> {
    let endpoint = endpoint
        .map(|value| value.trim().trim_end_matches('/').to_owned())
        .filter(|value| !value.is_empty());
    let Some(endpoint) = endpoint else {
        return Ok(TwilioConfig {
            api_url: API.into(),
            messaging_url: MESSAGING.into(),
            content_url: CONTENT.into(),
        });
    };
    if !local {
        return Err("CRM_TWILIO_ENDPOINT is only allowed in local development.".into());
    }
    let parsed = url::Url::parse(&endpoint).map_err(|_| "CRM_TWILIO_ENDPOINT must be a URL.")?;
    let loopback = matches!(parsed.host_str(), Some("127.0.0.1" | "localhost"));
    // The origin alone: no path, query, fragment or user information.
    let origin_only = parsed.origin().ascii_serialization() == endpoint;
    if parsed.scheme() != "http" || !loopback || !origin_only {
        return Err("CRM_TWILIO_ENDPOINT must be a loopback http:// origin.".into());
    }
    Ok(TwilioConfig {
        api_url: endpoint.clone(),
        messaging_url: endpoint.clone(),
        content_url: endpoint,
    })
}

#[cfg(test)]
mod tests {
    use super::twilio_config;

    #[test]
    fn twilio_hosts_are_real_unless_a_local_stand_in_is_named() {
        let real = twilio_config(None, false).unwrap();
        assert_eq!(real.api_url, super::API);
        assert_eq!(real.messaging_url, super::MESSAGING);
        assert_eq!(real.content_url, super::CONTENT);
        assert_eq!(
            twilio_config(Some(" ".into()), false).unwrap().api_url,
            super::API
        );
    }

    #[test]
    fn the_stand_in_replaces_every_host_and_is_loopback_and_local_only() {
        let local = twilio_config(Some("http://127.0.0.1:8794/".into()), true).unwrap();
        for host in [&local.api_url, &local.messaging_url, &local.content_url] {
            assert_eq!(host, "http://127.0.0.1:8794");
        }
        assert!(twilio_config(Some("http://localhost:8794".into()), true).is_ok());
        assert!(twilio_config(Some("http://127.0.0.1:8794".into()), false).is_err());
        for refused in [
            "https://127.0.0.1:8794",
            "http://example.com",
            "http://10.0.0.5:8794",
            "http://127.0.0.1:8794/2010-04-01",
            "http://127.0.0.1:8794?x=1",
            "http://user@127.0.0.1:8794",
            "not a url",
        ] {
            assert!(
                twilio_config(Some(refused.into()), true).is_err(),
                "{refused}"
            );
        }
    }
}
