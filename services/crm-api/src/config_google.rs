//! Google Workspace mail settings (packet E1, D4). Optional: without a client ID and
//! secret the CRM offers no Google mailbox connection. The redirect URI is derived from
//! the app origin, so it is always the one exact URI registered with Google.
const AUTHORIZE: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN: &str = "https://oauth2.googleapis.com/token";
const REVOKE: &str = "https://oauth2.googleapis.com/revoke";
const GMAIL: &str = "https://gmail.googleapis.com";
pub const CALLBACK_PATH: &str = "/api/crm/integrations/google/callback";

#[derive(Clone)]
pub struct GoogleConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    /// The company's Workspace domain; when set, only its addresses may connect.
    pub domain: Option<String>,
    pub authorize_url: String,
    pub token_url: String,
    pub revoke_url: String,
    pub gmail_url: String,
}

pub fn google_config(
    client_id: Option<String>,
    client_secret: Option<String>,
    domain: Option<String>,
    endpoint: Option<String>,
    origin: &str,
    local: bool,
) -> Result<Option<GoogleConfig>, String> {
    let given = |value: Option<String>| value.filter(|text| !text.trim().is_empty());
    let (client_id, client_secret) = match (given(client_id), given(client_secret)) {
        (None, None) => return Ok(None),
        (Some(id), Some(secret)) => (id.trim().to_owned(), secret.trim().to_owned()),
        _ => return Err("CRM_GOOGLE_CLIENT_ID and CRM_GOOGLE_CLIENT_SECRET go together.".into()),
    };
    let domain = given(domain).map(|value| value.trim().to_ascii_lowercase());
    if domain.as_deref().is_some_and(|value| {
        !value.contains('.')
            || !value
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || "-.".contains(character))
    }) {
        return Err("CRM_GOOGLE_WORKSPACE_DOMAIN must be a domain such as example.com.".into());
    }
    // Outside local development the domain is required, so a later switch of the Google
    // app from Internal to External cannot let personal accounts in (review L2).
    if domain.is_none() && !local {
        return Err("CRM_GOOGLE_WORKSPACE_DOMAIN is required with Google mail.".into());
    }
    let endpoint = given(endpoint).map(|value| value.trim().trim_end_matches('/').to_owned());
    if endpoint.is_some() && !local {
        return Err("CRM_GOOGLE_ENDPOINT is only allowed in local development.".into());
    }
    let at = |path: &str, real: &str| match &endpoint {
        Some(base) => format!("{base}{path}"),
        None => real.to_owned(),
    };
    Ok(Some(GoogleConfig {
        client_id,
        client_secret,
        redirect_uri: format!("{}{CALLBACK_PATH}", origin.trim_end_matches('/')),
        domain,
        authorize_url: at("/auth", AUTHORIZE),
        token_url: at("/token", TOKEN),
        revoke_url: at("/revoke", REVOKE),
        gmail_url: at("", GMAIL),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn some(value: &str) -> Option<String> {
        Some(value.into())
    }

    #[test]
    fn google_is_optional_and_needs_both_values() {
        let none = google_config(None, None, None, None, "https://crm.test", false);
        assert!(none.unwrap().is_none());
        assert!(google_config(some("id"), None, None, None, "https://crm.test", false).is_err());
    }

    #[test]
    fn the_redirect_is_fixed_and_the_endpoint_is_local_only() {
        let production = |domain| google_config(some("id"), some("s"), domain, None, "x", false);
        assert!(
            production(None).is_err(),
            "production needs the Workspace domain"
        );
        let config = google_config(
            some("id"),
            some("secret"),
            some("keys.example"),
            None,
            "https://crm.test/",
            false,
        )
        .unwrap()
        .unwrap();
        assert_eq!(
            config.redirect_uri,
            "https://crm.test/api/crm/integrations/google/callback"
        );
        assert_eq!(config.token_url, TOKEN);
        let stub = some("http://127.0.0.1:8791");
        assert!(google_config(
            some("id"),
            some("s"),
            None,
            stub.clone(),
            "https://c.test",
            false
        )
        .is_err());
        let local = google_config(
            some("id"),
            some("s"),
            None,
            stub,
            "http://localhost:5175",
            true,
        )
        .unwrap()
        .unwrap();
        assert_eq!(local.token_url, "http://127.0.0.1:8791/token");
    }

    #[test]
    fn the_workspace_domain_is_checked() {
        let bad = google_config(some("i"), some("s"), some("not a domain"), None, "x", true);
        assert!(bad.is_err());
        let good = google_config(some("i"), some("s"), some("Keys.Example"), None, "x", true);
        assert_eq!(
            good.unwrap().unwrap().domain.as_deref(),
            Some("keys.example")
        );
    }
}
