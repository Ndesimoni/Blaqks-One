//! Profile free text shown to every company (review amendment 8, MK1 code review M1): a
//! community is a name only. English letters, digits, spaces and `' - &` (English only, so
//! no other scripts' digits), never a dot (so no domain such as `wa.me`), never a link, and
//! no phone number or email address, even split across several communities.
use crate::agreements::listings::looks_like_contact;

/// Whether a community name uses only the characters a name needs.
pub fn plain(name: &str) -> bool {
    name.chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '\'' | '-' | '&'))
}

/// Whether text points somewhere rather than naming a place.
pub fn links(text: &str) -> bool {
    let lower = text.to_lowercase();
    ["http", "www", "@"].iter().any(|part| lower.contains(part))
}

/// Whether the names together carry a phone number or an email address. They are read in
/// order as one text, so a number split between two names is still found.
pub fn carries_contact(names: &[&str]) -> bool {
    looks_like_contact(&names.join(" ")) || names.iter().any(|name| links(name))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_plain_english_names_pass() {
        assert!(plain("Jumeirah Village Circle"));
        assert!(plain("Al Barsha 1"));
        assert!(plain("Emaar Beachfront - Tower 2 & 3"));
        assert!(!plain("Marina ٠٥٠١٢٣٤٥٦٧"), "other scripts' digits");
        assert!(!plain("Marina ０５０１２３４５６７"), "full-width digits");
        assert!(!plain("simonihomes.ae"), "a domain needs a dot");
        assert!(!plain("wa.me/971501234567"));
    }

    #[test]
    fn contacts_are_found_across_names_and_links_refused() {
        assert!(carries_contact(&["JVC 050 123", "4567 Marina"]));
        assert!(carries_contact(&["Dubai Hills", "www simoni"]));
        assert!(!carries_contact(&["Phase 2", "Building 7", "Dubai Marina"]));
    }
}
