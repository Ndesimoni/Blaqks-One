//! §13 L-F2 / owner Q9: finance foreign keys that reference connected records, listed
//! explicitly. Deleting or renaming a referenced Client or Property could otherwise end
//! in a foreign-key refusal that reveals hidden finance rows, so `covers_references`
//! also requires team finance ("See team finance") for these targets.

/// `(table, column, referenced collection)`; `crm_expenses` arrives with packet B4.
pub const FINANCE_REFERENCES: [(&str, &str, &str); 3] = [
    ("crm_deals", "client_ref", "Clients"),
    ("crm_deals", "property_ref", "Properties"),
    ("crm_expenses", "property_ref", "Properties"),
];

/// Whether any finance table references `collection`.
pub fn referenced(collection: &str) -> bool {
    FINANCE_REFERENCES
        .iter()
        .any(|(_, _, target)| *target == collection)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clients_and_properties_are_referenced_by_finance() {
        assert!(referenced("Clients") && referenced("Properties"));
        for other in ["Contacts", "Follow-ups", "Interaction log", "Deals"] {
            assert!(!referenced(other), "{other}");
        }
    }

    #[test]
    fn the_auth_policy_copy_matches_the_finance_references() {
        use crate::auth::policy::{finance_referenced, COLLECTIONS};
        for collection in COLLECTIONS.iter().chain(&["Deals"]) {
            assert_eq!(finance_referenced(collection), referenced(collection));
        }
    }
}
