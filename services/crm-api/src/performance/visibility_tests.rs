use super::*;
use crate::auth::permissions::{ChannelAccess, Permissions};
use serde_json::json;
use sqlx::types::Json;

fn user(role: &str, scope: &str, finance: bool, team_view: bool) -> UserRow {
    UserRow {
        id: Uuid::from_u128(7),
        name: "Member".into(),
        email: "member@example.test".into(),
        phone: "+971500000000".into(),
        role: role.into(),
        owner_id: None,
        workspace_id: "workspace".into(),
        positions: Json(Vec::new()),
        permissions: Json(Permissions {
            reports: true,
            finance,
            ..Default::default()
        }),
        channel_access: Json(ChannelAccess::default()),
        record_scope: scope.into(),
        actions: Json(json!({"finance": {"teamView": team_view}})),
    }
}

const ME: Option<Uuid> = Some(Uuid::from_u128(7));
const OTHER: Option<Uuid> = Some(Uuid::from_u128(8));

#[test]
fn admins_and_the_super_admin_see_every_target() {
    for role in ["admin", "super-admin"] {
        let viewer = user(role, "assigned", false, false);
        for metric in Metric::ALL {
            assert!(visible(&viewer, None, metric) && visible(&viewer, OTHER, metric));
        }
    }
    assert!(!visible(
        &user("guest", "team", true, true),
        None,
        Metric::Deals
    ));
}

#[test]
fn staff_see_their_own_targets_and_team_targets_with_team_scope() {
    let assigned = user("staff", "assigned", false, false);
    assert!(visible(&assigned, ME, Metric::Enquiries));
    assert!(!visible(&assigned, OTHER, Metric::Enquiries));
    assert!(!visible(&assigned, None, Metric::Enquiries));
    let team = user("staff", "team", false, false);
    assert!(visible(&team, None, Metric::Viewings));
    assert!(!visible(&team, OTHER, Metric::Viewings));
}

#[test]
fn fees_targets_follow_finance_access() {
    assert!(!visible(
        &user("staff", "team", false, false),
        ME,
        Metric::Fees
    ));
    assert!(!visible(
        &user("staff", "team", false, false),
        None,
        Metric::Fees
    ));
    let own = user("staff", "team", true, false);
    assert!(visible(&own, ME, Metric::Fees) && !visible(&own, None, Metric::Fees));
    let team = user("staff", "team", true, true);
    assert!(visible(&team, ME, Metric::Fees) && visible(&team, None, Metric::Fees));
}

#[test]
fn only_the_workspace_admin_edits() {
    assert!(can_edit(&user("admin", "team", true, true), "workspace"));
    assert!(!can_edit(&user("admin", "team", true, true), "other"));
    assert!(!can_edit(
        &user("super-admin", "team", true, true),
        "workspace"
    ));
    assert!(!can_edit(&user("staff", "team", true, true), "workspace"));
}
