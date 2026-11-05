//! The fixed lists of Blaqks One's own clients (docs/blaqks-one-console.md §9): where a
//! client came from, the sales stages and the kinds of timeline entry. The database checks
//! the same keys (migration 0093).

/// Where a client came from.
pub const SOURCES: [&str; 5] = ["website_form", "help_request", "referral", "call", "other"];

/// The sales stages, in order.
pub const STAGES: [(&str, &str); 6] = [
    ("new", "New"),
    ("contacted", "Contacted"),
    ("demo_booked", "Demo booked"),
    ("signed_up", "Signed up"),
    ("customer", "Customer"),
    ("lost", "Lost"),
];

/// Entries a person adds by hand: a note, or a call or message they made themselves.
pub const LOGGED: [&str; 5] = ["note", "call", "whatsapp", "email", "sms"];

pub const SOURCE: &str = "Choose a source: website_form, help_request, referral, call or other.";
pub const STAGE: &str = "Choose a stage: new, contacted, demo_booked, signed_up, customer or lost.";
pub const KIND: &str = "Choose what to log: note, call, whatsapp, email or sms.";

pub fn source(key: &str) -> Option<&'static str> {
    SOURCES.into_iter().find(|known| *known == key)
}

pub fn stage(key: &str) -> Option<&'static str> {
    STAGES
        .iter()
        .map(|(known, _)| *known)
        .find(|known| *known == key)
}

pub fn logged(key: &str) -> Option<&'static str> {
    LOGGED.into_iter().find(|known| *known == key)
}

/// The stage's name as people read it ("Demo booked").
pub fn stage_label(key: &str) -> &str {
    STAGES
        .iter()
        .find(|(known, _)| *known == key)
        .map_or(key, |(_, label)| label)
}

/// The timeline text for a stage change: "New → Contacted".
pub fn stage_change(from: &str, to: &str) -> String {
    format!("{} → {}", stage_label(from), stage_label(to))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_listed_keys_are_accepted() {
        assert_eq!(source("website_form"), Some("website_form"));
        assert_eq!(source("Website"), None);
        assert_eq!(stage("demo_booked"), Some("demo_booked"));
        assert_eq!(stage("won"), None);
        assert_eq!(logged("sms"), Some("sms"));
        assert_eq!(
            logged("stage"),
            None,
            "system entries are never logged by hand"
        );
    }

    #[test]
    fn stage_changes_read_as_names() {
        assert_eq!(stage_change("new", "contacted"), "New → Contacted");
        assert_eq!(
            stage_change("demo_booked", "signed_up"),
            "Demo booked → Signed up"
        );
    }
}
