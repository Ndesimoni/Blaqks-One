//! Social media links on the websites (docs/website-social-links.md, owner 2026-10-30):
//! six networks on their own profile hosts plus one "Other website", stored only in the
//! parser's canonical ASCII form and re-checked whenever they are served (review SOC1).
use serde_json::{Map, Value};
use url::{Host, Url};

use super::social_hosts::{NETWORKS, REDIRECTS, RESERVED, SHORTENERS, WEBSITE};

pub const INVALID: &str =
    "Enter social links as https:// profile addresses on each network's own site, plus at most one website.";

fn under(host: &str, domain: &str) -> bool {
    host == domain || host.ends_with(&format!(".{domain}"))
}

/// Percent-decodes until nothing changes, so a doubly encoded `https://` is still found.
fn unwrapped(mut text: String) -> String {
    for _ in 0..4 {
        let next =
            url::form_urlencoded::parse(format!("v={}", text.replace('&', "%26")).as_bytes())
                .map(|(_, v)| v.into_owned())
                .next()
                .unwrap_or_default();
        if next == text {
            break;
        }
        text = next;
    }
    text
}

/// Whether `value` is an acceptable, canonical link for `field`.
pub fn link(field: &str, value: &str) -> bool {
    let raw_ok = value.len() <= 300
        && value.starts_with("https://")
        && !value
            .chars()
            .any(|c| c.is_whitespace() || c.is_control() || c == '\\');
    let Some(url) = raw_ok.then(|| Url::parse(value).ok()).flatten() else {
        return false;
    };
    let Some(Host::Domain(host)) = url.host() else {
        return false;
    };
    let labels: Vec<&str> = host.split('.').collect();
    if url.as_str() != value
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || labels.len() < 2
        || labels.iter().any(|l| l.is_empty() || l.starts_with("xn--"))
        || url.query_pairs().any(|(_, v)| {
            let v = unwrapped(v.into_owned());
            v.contains("://") || v.starts_with("//")
        })
    {
        return false;
    }
    if field == WEBSITE {
        return !RESERVED.contains(labels.last().unwrap_or(&""))
            && !SHORTENERS.iter().any(|short| under(host, short));
    }
    let path = url.path().to_ascii_lowercase();
    let Some((_, domains, subdomains)) = NETWORKS.iter().find(|(name, ..)| *name == field) else {
        return false;
    };
    !REDIRECTS.iter().any(|prefix| path.starts_with(prefix))
        && domains.iter().any(|domain| {
            host == *domain
                || host.strip_suffix(&format!(".{domain}")).is_some_and(|sub| {
                    subdomains.contains(&sub)
                        || (field == "linkedin"
                            && sub.len() == 2
                            && sub.bytes().all(|b| b.is_ascii_lowercase()))
                })
        })
}

fn known(field: &str) -> bool {
    field == WEBSITE || NETWORKS.iter().any(|(name, ..)| *name == field)
}

/// A `social` object: known fields only, each a valid link.
pub fn links(value: &Value) -> bool {
    value.as_object().is_some_and(|object| {
        object
            .iter()
            .all(|(field, v)| known(field) && v.as_str().is_some_and(|text| link(field, text)))
    })
}

/// Refuses a `social` object that is present but not valid.
pub fn check(value: Option<&Value>) -> crate::error::ApiResult<()> {
    match value {
        Some(value) if !links(value) => Err(crate::error::ApiError::invalid(INVALID)),
        _ => Ok(()),
    }
}

/// The links safe to serve now, each re-checked (H1); a member's own website appears only
/// on their company's site, never the general site (H2). `None` when nothing remains.
pub fn public(value: Option<&Value>, member_on_platform: bool) -> Option<Value> {
    let kept: Map<String, Value> = value?
        .as_object()?
        .iter()
        .filter(|(field, v)| {
            known(field)
                && !(member_on_platform && *field == WEBSITE)
                && v.as_str().is_some_and(|text| link(field, text))
        })
        .map(|(field, v)| (field.clone(), v.clone()))
        .collect();
    (!kept.is_empty()).then_some(Value::Object(kept))
}

/// What a profile save stores: the member's own links, or the stored ones untouched when
/// someone else edits the profile (review M3). `null` when there are none.
pub fn stored(own: bool, input: Option<&Value>, previous: Option<&Value>) -> Value {
    let chosen = if own { input } else { previous };
    chosen
        .filter(|value| value.as_object().is_some_and(|o| !o.is_empty()))
        .cloned()
        .unwrap_or(Value::Null)
}

#[cfg(test)]
#[path = "social_tests.rs"]
mod tests;
