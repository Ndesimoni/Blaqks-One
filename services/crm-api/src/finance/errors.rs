//! Finance database errors (§13 M-F7). Finance triggers raise their own SQLSTATEs in
//! class P0 (never 23514 without a constraint), and the agreement exclusion constraint
//! raises 23P01. Each maps to the same response the Rust check gives first.
use crate::error::ApiError;

pub const OVERLAP: &str = "This agreement overlaps another agreement for this agent.";
pub const NOT_STAFF: &str = "Choose a staff member of this team.";
pub const STARTED: &str = "Agreements that have started cannot be removed.";
pub const TERMS_FIXED: &str = "Agreements cannot be edited. Add a new agreement instead.";

/// Maps a finance SQLSTATE; other codes keep the generic mapping in `error.rs`.
pub fn mapped(code: &str) -> Option<ApiError> {
    Some(match code {
        "23P01" => ApiError::conflict(OVERLAP),
        "P0F01" => ApiError::conflict(TERMS_FIXED),
        "P0F02" => ApiError::invalid(NOT_STAFF),
        "P0F03" => ApiError::conflict(STARTED),
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finance_codes_are_distinct_and_others_fall_through() {
        let status = |code| mapped(code).map(|error| (error.0.as_u16(), error.1));
        assert_eq!(status("23P01"), Some((409, OVERLAP)));
        assert_eq!(status("P0F01"), Some((409, TERMS_FIXED)));
        assert_eq!(status("P0F02"), Some((400, NOT_STAFF)));
        assert_eq!(status("P0F03"), Some((409, STARTED)));
        for other in ["23514", "23505", "23503", "P0001", ""] {
            assert!(mapped(other).is_none(), "{other}");
        }
    }
}
