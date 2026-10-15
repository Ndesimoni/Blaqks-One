//! Who sees and sets which targets (docs/product-decisions.md visibility rules). Admins and
//! the Super Admin read every target in a workspace they may open; staff read their own
//! member targets and, with whole-team scope, the team targets. Fees targets follow finance
//! access: own fees with any finance access, team fees with team finance only.
use super::input::Metric;
use crate::auth::{finance_access::FinanceScope, profile::UserRow};
use uuid::Uuid;

pub fn visible(viewer: &UserRow, member: Option<Uuid>, metric: Metric) -> bool {
    match viewer.role.as_str() {
        "admin" | "super-admin" => true,
        "staff" => {
            let finance = viewer.finance_access().scope;
            match member {
                Some(id) if id == viewer.id => {
                    metric != Metric::Fees || finance != FinanceScope::None
                }
                Some(_) => false,
                None => {
                    viewer.has_team_scope()
                        && (metric != Metric::Fees || finance == FinanceScope::Team)
                }
            }
        }
        _ => false,
    }
}

/// Only the workspace's own Admin sets targets; the Super Admin reads them.
pub fn can_edit(viewer: &UserRow, workspace: &str) -> bool {
    viewer.role == "admin" && viewer.workspace_id == workspace
}

#[cfg(test)]
#[path = "visibility_tests.rs"]
mod tests;
