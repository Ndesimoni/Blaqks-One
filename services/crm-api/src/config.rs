#[path = "config_signup.rs"]
mod signup_settings;

#[path = "config_messaging.rs"]
pub mod messaging_settings;

#[path = "config_google.rs"]
pub mod google_settings;

#[path = "config_media.rs"]
pub mod media_settings;

#[path = "config_sendgrid.rs"]
pub mod sendgrid_settings;

use google_settings::GoogleConfig;
use media_settings::MediaConfig;
use messaging_settings::{messaging_key, MessagingKey};
use sendgrid_settings::SendgridConfig;
use signup_settings::{client_secret, turnstile_config, worker_enabled};
use std::{env, net::SocketAddr};
use url::Url;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SignupMode {
    Off,
    Local,
}

pub struct Config {
    pub database_url: String,
    pub origin: String,
    pub address: SocketAddr,
    pub secure_cookie: bool,
    pub signup: SignupMode,
    /// Local delivery worker; API tests turn it off so they can inspect pending codes.
    pub signup_worker: bool,
    pub trusted_proxies: String,
    pub client_header: String,
    pub client_secret: String,
    pub turnstile: Option<TurnstileConfig>,
    /// Channel credentials are sealed only when this key is configured.
    pub messaging: Option<MessagingKey>,
    /// Google Workspace mailboxes (E1); `None` hides the Google connection.
    pub google: Option<GoogleConfig>,
    /// Private file storage (F1); `None` turns uploads off.
    pub media: Option<MediaConfig>,
    /// SendGrid's API address (E3); each company brings its own key.
    pub sendgrid: SendgridConfig,
}

#[derive(Clone)]
pub struct TurnstileConfig {
    pub secret: String,
    pub site_key: String,
    pub hostname: String,
    pub endpoint: String,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        let database_url =
            env::var("CRM_DATABASE_URL").map_err(|_| "CRM_DATABASE_URL is required.")?;
        let origin = env::var("CRM_APP_ORIGIN").map_err(|_| "CRM_APP_ORIGIN is required.")?;
        let insecure = env::var("CRM_ALLOW_INSECURE_LOCAL").as_deref() == Ok("true");
        let address: SocketAddr = env::var("CRM_BIND_ADDRESS")
            .unwrap_or_else(|_| "127.0.0.1:8788".into())
            .parse()
            .map_err(|_| "CRM_BIND_ADDRESS is invalid.")?;
        let secure_cookie = cookie_policy(&origin, insecure, address)?;
        let signup = signup_mode(env::var("CRM_SIGNUP").ok().as_deref(), secure_cookie)?;
        let signup_worker = worker_enabled(env::var("CRM_SIGNUP_WORKER").ok().as_deref())?;
        let trusted_proxies = env::var("CRM_TRUSTED_PROXIES").unwrap_or_default();
        let client_header =
            env::var("CRM_TRUSTED_CLIENT_HEADER").unwrap_or_else(|_| "cf-connecting-ip".into());
        let client_secret =
            client_secret(env::var("CRM_CLIENT_DIGEST_SECRET").ok(), !secure_cookie)?;
        let turnstile = turnstile_config(
            env::var("CRM_TURNSTILE_SECRET").ok(),
            env::var("CRM_TURNSTILE_SITE_KEY").ok(),
            env::var("CRM_TURNSTILE_HOSTNAME").ok(),
            env::var("CRM_TURNSTILE_ENDPOINT").ok(),
            !secure_cookie,
        )?;
        let messaging = messaging_key(
            env::var("CRM_MESSAGING_KEY").ok(),
            env::var("CRM_MESSAGING_KEY_VERSION").ok(),
            !secure_cookie,
        )?;
        let google = google_settings::from_env(&origin, !secure_cookie)?;
        let media = media_settings::from_env(!secure_cookie)?;
        let sendgrid = sendgrid_settings::from_env(!secure_cookie)?;
        Ok(Self {
            database_url,
            origin,
            address,
            secure_cookie,
            signup,
            signup_worker,
            trusted_proxies,
            client_header,
            client_secret,
            turnstile,
            messaging,
            google,
            media,
            sendgrid,
        })
    }
}

fn signup_mode(value: Option<&str>, secure_cookie: bool) -> Result<SignupMode, String> {
    match value.unwrap_or("off") {
        "off" => Ok(SignupMode::Off),
        "local" if !secure_cookie => Ok(SignupMode::Local),
        "local" => Err("CRM_SIGNUP=local requires insecure loopback development mode.".into()),
        "live" => {
            Err("CRM_SIGNUP=live is unavailable until provider adapters are configured.".into())
        }
        _ => Err("CRM_SIGNUP must be off, local or live.".into()),
    }
}

fn cookie_policy(origin: &str, insecure: bool, address: SocketAddr) -> Result<bool, String> {
    let parsed = Url::parse(origin).map_err(|_| "CRM_APP_ORIGIN must be an origin URL.")?;
    if parsed.origin().ascii_serialization() != origin
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("CRM_APP_ORIGIN must contain only scheme, host and optional port.".into());
    }
    let loopback = matches!(parsed.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if parsed.scheme() != "https" && !(insecure && loopback && parsed.scheme() == "http") {
        return Err("HTTPS is required; insecure mode accepts only loopback HTTP origins.".into());
    }
    if insecure && !(loopback && parsed.scheme() == "http") {
        return Err("CRM_ALLOW_INSECURE_LOCAL is only valid for loopback HTTP.".into());
    }
    if insecure && !address.ip().is_loopback() {
        return Err("Insecure local mode must bind to loopback.".into());
    }
    Ok(!insecure)
}

#[cfg(test)]
#[path = "config_tests.rs"]
mod tests;
