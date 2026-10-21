//! SendGrid settings (packet E3, docs/sendgrid-design.md). Each company connects its own
//! SendGrid account with its own key (decision E3a), so the CRM holds no SendGrid secret;
//! only the API address is configured, and a stand-in address is allowed locally alone.
//! `CRM_PUBLIC_URL` (decision D7) is where SendGrid reaches the CRM's webhooks; without it
//! no webhook is created and sent mail stays `sent`.
const API: &str = "https://api.sendgrid.com";

#[derive(Clone)]
pub struct SendgridConfig {
    /// `scheme://host[:port]` without a trailing slash.
    pub api_url: String,
    /// The CRM's public origin for webhooks: https, or http in local development only.
    pub webhook_base: Option<String>,
}

/// Reads `CRM_SENDGRID_ENDPOINT`, the local SendGrid stand-in (`npm run dev:sendgrid`).
pub fn from_env(local: bool) -> Result<SendgridConfig, String> {
    let mut config = sendgrid_config(std::env::var("CRM_SENDGRID_ENDPOINT").ok(), local)?;
    config.webhook_base = public_url(std::env::var("CRM_PUBLIC_URL").ok(), local)?;
    Ok(config)
}

pub fn public_url(value: Option<String>, local: bool) -> Result<Option<String>, String> {
    let Some(value) = value.map(|text| text.trim().trim_end_matches('/').to_owned()) else {
        return Ok(None);
    };
    if value.is_empty() {
        return Ok(None);
    }
    let parsed = url::Url::parse(&value).map_err(|_| "CRM_PUBLIC_URL must be a URL.")?;
    let scheme_ok = parsed.scheme() == "https" || (local && parsed.scheme() == "http");
    if !scheme_ok || parsed.origin().ascii_serialization() != value {
        return Err("CRM_PUBLIC_URL must be an https:// origin (http:// only locally).".into());
    }
    Ok(Some(value))
}

pub fn sendgrid_config(endpoint: Option<String>, local: bool) -> Result<SendgridConfig, String> {
    let endpoint = endpoint
        .map(|value| value.trim().trim_end_matches('/').to_owned())
        .filter(|value| !value.is_empty());
    let Some(endpoint) = endpoint else {
        return Ok(SendgridConfig {
            api_url: API.into(),
            webhook_base: None,
        });
    };
    if !local {
        return Err("CRM_SENDGRID_ENDPOINT is only allowed in local development.".into());
    }
    let parsed = url::Url::parse(&endpoint).map_err(|_| "CRM_SENDGRID_ENDPOINT must be a URL.")?;
    let loopback = matches!(parsed.host_str(), Some("127.0.0.1" | "localhost"));
    if parsed.scheme() != "http" || !loopback || parsed.path() != "/" || parsed.query().is_some() {
        return Err("CRM_SENDGRID_ENDPOINT must be a loopback http:// origin.".into());
    }
    Ok(SendgridConfig {
        api_url: endpoint,
        webhook_base: None,
    })
}

#[cfg(test)]
mod tests {
    use super::{public_url, sendgrid_config};

    #[test]
    fn the_stand_in_is_loopback_and_local_only() {
        assert_eq!(sendgrid_config(None, false).unwrap().api_url, super::API);
        let local = sendgrid_config(Some("http://127.0.0.1:8792/".into()), true).unwrap();
        assert_eq!(local.api_url, "http://127.0.0.1:8792");
        assert!(sendgrid_config(Some("http://127.0.0.1:8792".into()), false).is_err());
        assert!(sendgrid_config(Some("http://example.com".into()), true).is_err());
        assert!(sendgrid_config(Some("http://127.0.0.1:8792/v3".into()), true).is_err());
        assert!(sendgrid_config(Some(" ".into()), false).is_ok());
        let https = Some("https://crm.example.com/".into());
        assert_eq!(
            public_url(https, false).unwrap().unwrap(),
            "https://crm.example.com"
        );
        assert!(public_url(Some("http://127.0.0.1:8790".into()), false).is_err());
        assert!(public_url(Some("http://127.0.0.1:8790".into()), true).is_ok());
        assert!(public_url(Some("https://crm.example.com/api".into()), false).is_err());
        assert_eq!(public_url(None, false), Ok(None));
    }
}
