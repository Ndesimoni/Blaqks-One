//! Finance database errors (§13 M-F7). Finance triggers raise their own SQLSTATEs in
//! class P0 (never 23514 without a constraint), and the agreement exclusion constraint
//! raises 23P01. Each maps to the same response the Rust check gives first.
use crate::error::ApiError;

pub const OVERLAP: &str = "This agreement overlaps another agreement for this agent.";
pub const NOT_STAFF: &str = "Choose a staff member of this team.";
pub const STARTED: &str = "Agreements that have started cannot be removed.";
pub const TERMS_FIXED: &str = "Agreements cannot be edited. Add a new agreement instead.";
pub const INELIGIBLE: &str = "Choose an active team member with finance access.";
pub const EARNED_LOCKED: &str = "Earned deals can only be changed by your Admin.";
pub const DEAL_ID_FIXED: &str = "Deal IDs cannot be changed.";
pub const HISTORY_FIXED: &str = "Earned commission history cannot be changed.";
pub const SPLIT_TOTAL: &str = "The commission split does not add up. Reload and try again.";

/// Maps a finance SQLSTATE; other codes keep the generic mapping in `error.rs`.
pub fn mapped(code: &str) -> Option<ApiError> {
    Some(match code {
        "23P01" => ApiError::conflict(OVERLAP),
        "P0F01" => ApiError::conflict(TERMS_FIXED),
        "P0F02" => ApiError::invalid(NOT_STAFF),
        "P0F03" => ApiError::conflict(STARTED),
        "P0F04" => ApiError::invalid(INELIGIBLE),
        "P0F05" => ApiError::denied(EARNED_LOCKED),
        "P0F06" => ApiError::invalid(DEAL_ID_FIXED),
        "P0F07" => ApiError::conflict(HISTORY_FIXED),
        "P0F08" => ApiError::conflict(SPLIT_TOTAL),
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
        assert_eq!(status("P0F04"), Some((400, INELIGIBLE)));
        assert_eq!(status("P0F05"), Some((403, EARNED_LOCKED)));
        assert_eq!(status("P0F06"), Some((400, DEAL_ID_FIXED)));
        assert_eq!(status("P0F07"), Some((409, HISTORY_FIXED)));
        assert_eq!(status("P0F08"), Some((409, SPLIT_TOTAL)));
        for other in ["23514", "23505", "23503", "P0001", ""] {
            assert!(mapped(other).is_none(), "{other}");
        }
    }
}
