//! Marketplace SQLSTATE mapping (docs/broker-marketplace.md §14 amendment 10). Evidence
//! tables raise `P0M01` on UPDATE, DELETE and TRUNCATE; the Rust checks run first, so this
//! is the database backstop.
use crate::error::ApiError;

pub const EVIDENCE: &str = "Marketplace evidence is insert-only.";

pub fn mapped(code: &str) -> Option<ApiError> {
    Some(match code {
        "P0M01" => ApiError::conflict(EVIDENCE),
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_marketplace_codes_map_and_others_fall_through() {
        let status = |code| mapped(code).map(|error| (error.0.as_u16(), error.2));
        assert_eq!(status("P0M01"), Some((409, "conflict")));
        assert_eq!(status("P0M02"), None);
        assert_eq!(status("P0G01"), None);
    }
}
