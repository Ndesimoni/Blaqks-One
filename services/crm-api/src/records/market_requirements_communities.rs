//! The community names a stored client carries (packet MK2): comma, semicolon or new-line
//! separated, trimmed, inner spaces collapsed, at most twelve, each under the MK1 free-text rules.
//! A name that looks like a phone number, an email or a link is dropped, never sent.
use super::market_requirements::MAX_COMMUNITIES;
use crate::agreements::listings::looks_like_contact;

/// Whether a name may be repeated as a community.
fn plainer(name: &str) -> bool {
    !name.is_empty()
        && name.chars().count() <= 60
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '\'' | '-' | '&'))
        && !["http", "www", "@"]
            .iter()
            .any(|part| name.to_lowercase().contains(part))
        && !looks_like_contact(name)
}

/// The usable names, in stored order, without repeats (compared lower-cased).
pub fn communities(stored: Option<&str>) -> Vec<String> {
    let Some(stored) = stored else {
        return Vec::new();
    };
    let mut names: Vec<String> = Vec::new();
    let mut keys: Vec<String> = Vec::new();
    for part in stored.split([',', ';', '\n']) {
        let name = part.split_whitespace().collect::<Vec<_>>().join(" ");
        if !plainer(&name) || keys.contains(&name.to_lowercase()) {
            continue;
        }
        keys.push(name.to_lowercase());
        names.push(name);
        if names.len() == MAX_COMMUNITIES {
            break;
        }
    }
    names
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_split_trimmed_and_deduplicated() {
        let stored = " Dubai   Marina ; JVC ,, jvc\nAl Barsha 1 ";
        assert_eq!(
            communities(Some(stored)),
            ["Dubai Marina", "JVC", "Al Barsha 1"]
        );
        assert!(communities(None).is_empty());
    }

    #[test]
    fn contact_details_and_links_are_dropped() {
        let stored = "wa.me/971501234567, Marina 050 123 4567, A@b, JVC";
        assert_eq!(communities(Some(stored)), ["JVC"]);
    }
}
