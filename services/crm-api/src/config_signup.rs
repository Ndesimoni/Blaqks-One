//! Sign-up settings read by `Config::from_env` (packets R1 and R2).
use super::TurnstileConfig;

const DEV_SECRET: &str = "local-development-digest-secret";
const SITEVERIFY: &str = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/// The key for client-address digests. Local development may use a fixed value;
/// anywhere else it must be a private secret of at least 32 characters.
pub(super) fn client_secret(value: Option<String>, local: bool) -> Result<String, String> {
    match value.filter(|text| !text.trim().is_empty()) {
        Some(secret) if local || secret.len() >= 32 => Ok(secret),
        Some(_) => Err("CRM_CLIENT_DIGEST_SECRET must be at least 32 characters.".into()),
        None if local => Ok(DEV_SECRET.into()),
        None => Err("CRM_CLIENT_DIGEST_SECRET is required outside local development.".into()),
    }
}

/// All three Turnstile values, or none. Only local development may point Siteverify at
/// another address, such as a loopback stub; everywhere else it is Cloudflare's.
pub(super) fn turnstile_config(
    secret: Option<String>,
    site_key: Option<String>,
    hostname: Option<String>,
    endpoint: Option<String>,
    local: bool,
) -> Result<Option<TurnstileConfig>, String> {
    let configured = [&secret, &site_key, &hostname]
        .iter()
        .filter(|value| value.as_deref().is_some_and(|text| !text.trim().is_empty()))
        .count();
    if configured == 0 {
        return Ok(None);
    }
    if configured != 3 {
        return Err("Turnstile requires a secret, site key and hostname.".into());
    }
    let endpoint = endpoint.filter(|value| !value.trim().is_empty());
    if endpoint.is_some() && !local {
        return Err("CRM_TURNSTILE_ENDPOINT is only allowed in local development.".into());
    }
    Ok(Some(TurnstileConfig {
        secret: secret.unwrap(),
        site_key: site_key.unwrap(),
        hostname: hostname.unwrap(),
        endpoint: endpoint.unwrap_or_else(|| SITEVERIFY.into()),
    }))
}

pub(super) fn worker_enabled(value: Option<&str>) -> Result<bool, String> {
    match value.unwrap_or("on") {
        "on" => Ok(true),
        "off" => Ok(false),
        _ => Err("CRM_SIGNUP_WORKER must be on or off.".into()),
    }
}
