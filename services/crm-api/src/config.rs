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
        Ok(Self {
            database_url,
            origin,
            address,
            secure_cookie,
            signup,
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
