use super::*;
use crate::auth::{actions::Actions, permissions::ChannelAccess};
use serde_json::json;
use sqlx::types::Json;
use uuid::Uuid;

fn finance(on: bool) -> Permissions {
    Permissions {
        finance: on,
        ..Default::default()
    }
}

fn user(role: &str, scope: &str, module: bool, finance: Value) -> UserRow {
    let mut actions = serde_json::to_value(Actions::preset(&Permissions::default())).unwrap();
    actions["finance"] = finance;
    UserRow {
        id: Uuid::nil(),
        name: "Member".into(),
        email: "member@example.test".into(),
        phone: "+971500000000".into(),
        role: role.into(),
        owner_id: None,
        workspace_id: "workspace".into(),
        positions: Json(Vec::new()),
        permissions: Json(self::finance(module)),
        channel_access: Json(ChannelAccess::default()),
        record_scope: scope.into(),
        actions: Json(actions),
        language: None,
        guidance_enabled: None,
    }
}

fn all() -> Value {
    json!({"create":true,"edit":true,"assign":true,"approve":true,"teamView":true})
}

#[test]
fn staff_flags_need_the_module_and_team_view_needs_team_scope() {
    let team = user("staff", "team", true, all()).finance_access();
    assert_eq!(team.scope, FinanceScope::Team);
    assert!(team.approve && team.team_view && team.create && !team.manage);
    let assigned = user("staff", "assigned", true, all()).finance_access();
    assert_eq!(assigned.scope, FinanceScope::Own);
    assert!(assigned.create && !assigned.team_view && !assigned.approve);
    let no_module = user("staff", "team", false, all()).finance_access();
    assert_eq!(no_module.scope, FinanceScope::None);
    assert!(!no_module.create && !no_module.team_view);
    let approve_only = json!({"approve":true,"teamView":false});
    let access = user("staff", "team", true, approve_only).finance_access();
    assert!(!access.approve, "approve needs teamView");
    assert_eq!(
        access.scope,
        FinanceScope::Own,
        "full-team access alone is own view"
    );
}

#[test]
fn roles_are_an_allowlist_and_the_super_admin_only_views() {
    let admin = user("admin", "assigned", false, json!({})).finance_access();
    assert_eq!(admin.scope, FinanceScope::Team);
    assert!(admin.manage && admin.approve && admin.create && admin.assign);
    let platform = user("super-admin", "assigned", false, json!({})).finance_access();
    assert_eq!(platform.scope, FinanceScope::Team);
    assert!(platform.team_view && !platform.manage && !platform.approve && !platform.create);
    assert!(!platform.edit && !platform.assign);
    for role in ["viewer", "", "Admin", "STAFF"] {
        let odd = user(role, "team", true, all()).finance_access();
        assert_eq!(odd.scope, FinanceScope::None, "{role}");
        assert!(!odd.create && !odd.manage && !odd.team_view, "{role}");
    }
    let profile = serde_json::to_value(platform).unwrap();
    assert_eq!(
        profile,
        json!({"scope":"team","create":false,"edit":false,"assign":false,
            "approve":false,"teamView":true,"manage":false})
    );
}

#[test]
fn stored_decoder_is_lenient_and_presets_never_grant_approval() {
    for malformed in [
        json!(null),
        json!("x"),
        json!({"finance":"yes"}),
        json!({"finance":[]}),
    ] {
        assert_eq!(
            FinanceActions::from_stored(&malformed),
            FinanceActions::default()
        );
    }
    let odd = json!({"finance":{"create":1,"edit":"true","approve":true,"x":true}});
    let stored = FinanceActions::from_stored(&odd);
    assert!(stored.approve && !stored.create && !stored.edit);
    let preset = FinanceActions::preset(&finance(true));
    assert!(preset.create && preset.edit && preset.assign);
    assert!(!preset.approve && !preset.team_view);
    assert_eq!(
        FinanceActions::preset(&finance(false)),
        FinanceActions::default()
    );
    let full = FinanceActions::from_stored(&json!({"finance": all()}));
    assert_eq!(
        full.normalised(&finance(false), true),
        FinanceActions::default()
    );
    let assigned = full.normalised(&finance(true), false);
    assert!(assigned.create && !assigned.team_view && !assigned.approve);
}

#[test]
fn carrying_over_keeps_enabled_finance_and_presets_a_new_module() {
    let mut stored = Actions::preset(&finance(true));
    stored.finance.create = false;
    let kept = stored.carried_over(&finance(true), &finance(true), false);
    assert!(
        !kept.finance.create && kept.finance.edit,
        "positions never widen finance"
    );
    let fresh = Actions::default().carried_over(&finance(false), &finance(true), true);
    assert_eq!(fresh.finance, FinanceActions::preset(&finance(true)));
    stored.finance.team_view = true;
    let lost = stored.carried_over(&finance(true), &finance(true), false);
    assert!(
        !lost.finance.team_view,
        "scope change to assigned clears teamView"
    );
}
