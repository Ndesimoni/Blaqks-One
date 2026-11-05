//! Performance messages and database errors. The identity trigger on `crm_targets` raises
//! P0P01; every other code keeps the generic mapping in `error.rs`.
use crate::error::ApiError;

pub const MANAGE: &str = "Only your Admin can set targets.";
pub const INVALID: &str = "Provide a valid target.";
pub const MONTH: &str = "Choose a valid month.";
pub const METRIC: &str = "Choose a valid target measure.";
pub const VALUE: &str = "Enter a whole-number target within the allowed range.";
pub const MEMBER: &str = "Choose an active member of this team.";
pub const STALE: &str = "This target changed. Reload before saving.";
pub const FIXED: &str = "A target keeps its member, month and measure.";

/// Maps a performance SQLSTATE; other codes fall through.
pub fn mapped(code: &str) -> Option<ApiError> {
    match code {
        "P0P01" => Some(ApiError::conflict(FIXED)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_identity_code_is_mapped() {
        let error = mapped("P0P01").expect("mapped");
        assert_eq!((error.0.as_u16(), error.1), (409, FIXED));
        for other in ["P0F01", "23505", "23514", ""] {
            assert!(mapped(other).is_none(), "{other}");
        }
    }
}
