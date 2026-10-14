//! First of two checks before any sample-data write: the local development
//! configuration and a loopback database host, checked before connecting. A loopback
//! port can still be a tunnel to another server, so `marker` then requires the
//! database itself to be marked as the local Docker database.
use std::net::IpAddr;
use url::{Host, Url};

pub const LOCAL_ONLY: &str = "Sample data commands are for a local development database only. \
     They need CRM_ALLOW_INSECURE_LOCAL=true and a loopback CRM_DATABASE_URL host \
     (localhost, 127.0.0.1 or ::1). Nothing was changed.";

/// `insecure` is the validated `CRM_ALLOW_INSECURE_LOCAL=true` mode (loopback HTTP
/// origin and bind address). The database host must also be loopback, with no query
/// parameter that could redirect the connection elsewhere.
pub fn ensure_local(insecure: bool, database_url: &str) -> Result<(), String> {
    if !insecure {
        return Err(LOCAL_ONLY.into());
    }
    let url = Url::parse(database_url).map_err(|_| LOCAL_ONLY.to_owned())?;
    let loopback = match url.host() {
        Some(Host::Domain(name)) => {
            name.eq_ignore_ascii_case("localhost")
                || name.parse::<IpAddr>().is_ok_and(|ip| ip.is_loopback())
        }
        Some(Host::Ipv4(ip)) => ip.is_loopback(),
        Some(Host::Ipv6(ip)) => ip.is_loopback(),
        None => false,
    };
    let redirected = url.query_pairs().any(|(key, _)| {
        matches!(
            key.to_ascii_lowercase().as_str(),
            "host" | "hostaddr" | "service"
        )
    });
    let postgres = matches!(url.scheme(), "postgres" | "postgresql");
    if !postgres || !loopback || redirected {
        return Err(LOCAL_ONLY.into());
    }
    Ok(())
}

/// `host:port/database` for the confirmation summary; never the user or password.
pub fn describe(database_url: &str) -> String {
    match Url::parse(database_url) {
        Ok(url) => format!(
            "{}:{}{}",
            url.host_str().unwrap_or("?"),
            url.port().unwrap_or(5432),
            url.path()
        ),
        Err(_) => "an unreadable database URL".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_loopback_databases_in_local_mode() {
        for url in [
            "postgres://kws:secret@127.0.0.1:55432/kws_crm",
            "postgres://kws:secret@localhost:5432/kws_crm",
            "postgresql://kws@[::1]:5432/kws_crm?sslmode=disable",
            "postgres://kws@127.0.0.2/kws_crm",
        ] {
            assert!(ensure_local(true, url).is_ok(), "{url}");
        }
    }

    #[test]
    fn describes_the_database_without_credentials() {
        let url = "postgres://kws:secret@127.0.0.1:55432/kws_crm?sslmode=disable";
        assert_eq!(describe(url), "127.0.0.1:55432/kws_crm");
        assert_eq!(
            describe("postgres://kws@localhost/kws"),
            "localhost:5432/kws"
        );
    }

    #[test]
    fn refuses_hosted_redirected_or_non_local_configurations() {
        let local = "postgres://kws:secret@127.0.0.1:55432/kws_crm";
        assert_eq!(ensure_local(false, local).unwrap_err(), LOCAL_ONLY);
        for url in [
            "postgres://kws:secret@db.example.com:5432/kws_crm",
            "postgres://kws:secret@10.0.0.5:5432/kws_crm",
            "postgres://kws@[2001:db8::1]:5432/kws_crm",
            "postgres://kws@localhost.example.com/kws_crm",
            "postgres:///kws_crm",
            "postgres://kws@127.0.0.1/kws_crm?host=db.example.com",
            "postgres://kws@127.0.0.1/kws_crm?HostAddr=10.0.0.5",
            "mysql://kws@127.0.0.1/kws_crm",
            "not a url",
        ] {
            assert_eq!(ensure_local(true, url).unwrap_err(), LOCAL_ONLY, "{url}");
        }
    }
}
