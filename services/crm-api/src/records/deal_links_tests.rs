use super::*;
use crate::auth::permissions::Permissions;
use serde_json::json;
use sqlx::types::Json;

fn user(role: &str, scope: &str, permissions: Permissions, finance: Value) -> UserRow {
    UserRow {
        id: Uuid::from_u128(7),
        name: "Member".into(),
        email: "member@example.test".into(),
        phone: "+971500000000".into(),
        role: role.into(),
        owner_id: None,
        workspace_id: "workspace".into(),
        positions: Json(Vec::new()),
        permissions: Json(permissions),
        channel_access: Json(Default::default()),
        record_scope: scope.into(),
        actions: Json(json!({ "finance": finance })),
    }
}

fn modules(schedule: bool, finance: bool) -> Permissions {
    Permissions {
        relationships: true,
        schedule,
        finance,
        ..Default::default()
    }
}

const TEAM_VIEW: fn() -> Value = || json!({"create": true, "teamView": true});

#[test]
fn deals_are_linkable_only_under_the_callers_finance_view() {
    let id = Some(Uuid::from_u128(7));
    for role in ["admin", "super-admin"] {
        let admin = user(role, "assigned", Permissions::default(), json!({}));
        assert_eq!(finance_caller(&admin), Some(None), "{role}");
    }
    let schedule_only = user("staff", "team", modules(true, false), TEAM_VIEW());
    assert_eq!(finance_caller(&schedule_only), None);
    let own = user(
        "staff",
        "assigned",
        modules(true, true),
        json!({"create": true}),
    );
    assert_eq!(finance_caller(&own), Some(id));
    let assigned_view = user("staff", "assigned", modules(true, true), TEAM_VIEW());
    assert_eq!(finance_caller(&assigned_view), Some(id));
    let team = user("staff", "team", modules(true, true), TEAM_VIEW());
    assert_eq!(finance_caller(&team), Some(None));
    let odd = user("viewer", "team", Permissions::full(), TEAM_VIEW());
    assert_eq!(finance_caller(&odd), None);
}

#[test]
fn deal_link_messages_match_payments_and_deal_deletes_need_schedule() {
    assert_eq!(
        missing_message(Slot::Deal),
        "The linked deal is missing from this workspace. Choose another deal or clear it."
    );
    let error = ApiError::link_missing(missing_message(Slot::Deal));
    assert_eq!((error.0.as_u16(), error.2), (409, "link_missing"));
    // M-C (finance-design §5.4): Interaction log links to Deals, so deleting a deal also
    // needs the schedule module. Admins hold it by role.
    let admin = user("admin", "assigned", Permissions::default(), json!({}));
    assert!(admin.covers_references("Deals"));
    let finance_only = user("staff", "team", modules(false, true), TEAM_VIEW());
    assert!(!finance_only.covers_references("Deals"));
    assert!(user("staff", "team", modules(true, true), TEAM_VIEW()).covers_references("Deals"));
}
