//! The collection facts that grants depend on (action-permissions §3, M-C, L-F2). Records
//! and finance own these facts; auth keeps this checked copy so identity imports no
//! business domain (service-boundaries C6, rule 5). Tests in `records::collections` and
//! `finance::references` fail if the copy drifts from its owners.

/// The eight connected collections, in `records::collections::COLLECTIONS` order.
pub const COLLECTIONS: [&str; 8] = [
    "Contacts",
    "Clients",
    "Properties",
    "Follow-ups",
    "Viewings",
    "Shortlist",
    "Interaction log",
    "Client care",
];

/// Collections that carry `assignee_id` (`records::visibility::ASSIGNABLE`).
pub const ASSIGNABLE: [&str; 4] = ["Clients", "Properties", "Contacts", "Follow-ups"];

/// Parent records (`records::visibility::PARENTS`): deleting one needs team scope,
/// deleteMain and reference coverage (H2, A2 M-C).
pub const PARENTS: [&str; 3] = ["Clients", "Properties", "Contacts"];

/// Each link target with the collections whose records may link to it, as declared by
/// `records::collections::COLLECTIONS`, sorted by target. Unlisted targets have none.
pub const LINKED_FROM: [(&str, &[&str]); 4] = [
    (
        "Clients",
        &[
            "Clients",
            "Follow-ups",
            "Viewings",
            "Shortlist",
            "Interaction log",
            "Client care",
        ],
    ),
    ("Contacts", &["Properties"]),
    ("Deals", &["Interaction log"]),
    (
        "Properties",
        &[
            "Follow-ups",
            "Viewings",
            "Shortlist",
            "Interaction log",
            "Client care",
        ],
    ),
];

/// Collections that finance tables reference (`finance::references`, L-F2, owner Q9).
pub const FINANCE_REFERENCED: [&str; 2] = ["Clients", "Properties"];

/// The collections that may link to `target`.
pub fn linked_from(target: &str) -> &'static [&'static str] {
    LINKED_FROM
        .iter()
        .find(|(name, _)| *name == target)
        .map_or(&[], |(_, linking)| *linking)
}

/// Whether any finance table references `collection`.
pub fn finance_referenced(collection: &str) -> bool {
    FINANCE_REFERENCED.contains(&collection)
}
