//! Agreement SQLSTATE mapping (docs/agreements-design.md §10). The guards raise
//! distinct P0G codes; Rust checks the same rules first, so these are the
//! database backstop.
use crate::error::ApiError;

pub const FROZEN: &str = "Agreement terms are frozen. Add a new revision instead.";
pub const CLOSED: &str = "This agreement cannot move to that state.";
pub const IDENTITY: &str = "Agreement identity cannot be changed.";
pub const REVISION: &str = "The agreement revision is invalid.";
pub const HANDOVER: &str = "Use Deals to act on this hand-over.";

pub fn mapped(code: &str) -> Option<ApiError> {
    Some(match code {
        "P0G01" | "P0G02" => ApiError::conflict(FROZEN),
        "P0G03" => ApiError::conflict(REVISION),
        "P0G04" | "P0G05" => ApiError::conflict(IDENTITY),
        "P0G06" => ApiError::conflict(CLOSED),
        "P0G07" => ApiError::conflict(HANDOVER),
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn agreement_codes_map_to_conflicts_and_others_fall_through() {
        let status = |code| mapped(code).map(|error| (error.0.as_u16(), error.2));
        assert_eq!(status("P0G01"), Some((409, "conflict")));
        assert_eq!(status("P0G06"), Some((409, "conflict")));
        assert_eq!(status("P0G07"), Some((409, "conflict")));
        assert_eq!(status("P0F01"), None);
        assert_eq!(status("23505"), None);
    }
}
