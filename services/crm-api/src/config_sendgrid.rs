//! SendGrid settings (packet E3, docs/sendgrid-design.md). Each company connects its own
//! SendGrid account with its own key (decision E3a), so the CRM holds no SendGrid secret;
//! only the API address is configured, and a stand-in address is allowed locally alone.
const API: &str = "https://api.sendgrid.com";

#[derive(Clone)]
pub struct SendgridConfig {
    /// `scheme://host[:port]` without a trailing slash.
    pub api_url: String,
}

/// Reads `CRM_SENDGRID_ENDPOINT`, the local SendGrid stand-in (`npm run dev:sendgrid`).
pub fn from_env(local: bool) -> Result<SendgridConfig, String> {
    sendgrid_config(std::env::var("CRM_SENDGRID_ENDPOINT").ok(), local)
}

pub fn sendgrid_config(endpoint: Option<String>, local: bool) -> Result<SendgridConfig, String> {
    let endpoint = endpoint
        .map(|value| value.trim().trim_end_matches('/').to_owned())
        .filter(|value| !value.is_empty());
    let Some(endpoint) = endpoint else {
        return Ok(SendgridConfig {
            api_url: API.into(),
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
    Ok(SendgridConfig { api_url: endpoint })
}

#[cfg(test)]
mod tests {
    use super::sendgrid_config;

    #[test]
    fn the_stand_in_is_loopback_and_local_only() {
        assert_eq!(sendgrid_config(None, false).unwrap().api_url, super::API);
        let local = sendgrid_config(Some("http://127.0.0.1:8792/".into()), true).unwrap();
        assert_eq!(local.api_url, "http://127.0.0.1:8792");
        assert!(sendgrid_config(Some("http://127.0.0.1:8792".into()), false).is_err());
        assert!(sendgrid_config(Some("http://example.com".into()), true).is_err());
        assert!(sendgrid_config(Some("http://127.0.0.1:8792/v3".into()), true).is_err());
        assert!(sendgrid_config(Some(" ".into()), false).is_ok());
    }
}
