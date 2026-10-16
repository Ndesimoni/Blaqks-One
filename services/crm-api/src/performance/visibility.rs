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

/// SQL scalar for the activity feed: the ID of the target that the `crm_activity` row
/// aliased `activity` names, when it still exists in `workspace` and [`visible`] would
/// show it to `viewer` now; otherwise NULL. `caller` is bound to the viewer's ID. The
/// flags come from the live profile, never from the request.
pub fn activity_target(activity: &str, workspace: &str, caller: &str, viewer: &UserRow) -> String {
    let finance = viewer.finance_access().scope;
    let condition = match viewer.role.as_str() {
        "admin" | "super-admin" => format!("({caller}::uuid IS NOT NULL)"),
        "staff" => format!(
            "((t.member_id={caller} AND (t.metric<>'fees' OR {own_fees})) \
             OR (t.member_id IS NULL AND {team} AND (t.metric<>'fees' OR {team_fees})))",
            own_fees = finance != FinanceScope::None,
            team = viewer.has_team_scope(),
            team_fees = finance == FinanceScope::Team,
        ),
        _ => format!("({caller}::uuid IS NULL AND false)"),
    };
    format!(
        "CASE WHEN {activity}.collection='Targets' THEN (SELECT t.id FROM crm_targets t \
         WHERE t.id={activity}.record_id AND t.workspace_id={workspace} AND {condition}) END"
    )
}

#[cfg(test)]
#[path = "visibility_tests.rs"]
mod tests;
