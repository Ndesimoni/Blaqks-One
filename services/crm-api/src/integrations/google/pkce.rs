//! The browser leg of Google sign-in: a fresh state and PKCE verifier per request, and
//! the authorization URL with the narrowest mail scopes (design §8, plan E1.1).
use crate::config::google_settings::GoogleConfig;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use sha2::{Digest, Sha256};
use url::Url;

/// Send mail as the person, and read it so client replies reach the Inbox (E1c).
pub const SEND: &str = "https://www.googleapis.com/auth/gmail.send";
pub const READ: &str = "https://www.googleapis.com/auth/gmail.readonly";

/// RFC 7636 S256: `BASE64URL(SHA256(verifier))`.
pub fn challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

pub fn authorize_url(config: &GoogleConfig, state: &str, verifier: &str) -> String {
    let mut url = Url::parse(&config.authorize_url).expect("Google authorize URL is valid");
    {
        let mut query = url.query_pairs_mut();
        query
            .append_pair("client_id", &config.client_id)
            .append_pair("redirect_uri", &config.redirect_uri)
            .append_pair("response_type", "code")
            .append_pair("scope", &format!("{SEND} {READ}"))
            .append_pair("access_type", "offline")
            .append_pair("prompt", "consent")
            .append_pair("state", state)
            .append_pair("code_challenge", &challenge(verifier))
            .append_pair("code_challenge_method", "S256");
        if let Some(domain) = &config.domain {
            query.append_pair("hd", domain);
        }
    }
    url.into()
}

/// Google may let a person untick a scope; the CRM connects only with both.
pub fn granted_both(scope: &str) -> bool {
    let granted: Vec<&str> = scope.split_whitespace().collect();
    granted.contains(&SEND) && granted.contains(&READ)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::google_settings::google_config;

    #[test]
    fn the_challenge_matches_rfc_7636_appendix_b() {
        assert_eq!(
            challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn the_url_asks_for_offline_mail_access_with_pkce() {
        let config = google_config(
            Some("client".into()),
            Some("secret".into()),
            Some("keys.example".into()),
            None,
            "https://crm.test",
            false,
        )
        .unwrap()
        .unwrap();
        let url = Url::parse(&authorize_url(&config, "state-1", "verifier-1")).unwrap();
        let pairs: Vec<(String, String)> = url.query_pairs().into_owned().collect();
        let value = |key: &str| {
            pairs
                .iter()
                .find(|(name, _)| name == key)
                .unwrap()
                .1
                .clone()
        };
        assert_eq!(value("state"), "state-1");
        assert_eq!(value("code_challenge"), challenge("verifier-1"));
        assert_eq!(value("code_challenge_method"), "S256");
        assert_eq!(value("access_type"), "offline");
        assert_eq!(value("hd"), "keys.example");
        assert_eq!(
            value("redirect_uri"),
            "https://crm.test/api/crm/integrations/google/callback"
        );
        assert!(granted_both(&value("scope")));
    }

    #[test]
    fn both_mail_scopes_are_required() {
        assert!(granted_both(&format!("{READ} openid {SEND}")));
        assert!(!granted_both(SEND));
        assert!(!granted_both(""));
    }
}
