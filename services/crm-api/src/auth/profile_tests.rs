use super::*;

fn user(role: &str, record_scope: &str) -> UserRow {
    UserRow {
        id: Uuid::nil(),
        name: "Member".into(),
        email: "member@example.test".into(),
        phone: "+971500000000".into(),
        role: role.into(),
        owner_id: None,
        workspace_id: "workspace".into(),
        positions: Json(Vec::new()),
        permissions: Json(Permissions::default()),
        channel_access: Json(ChannelAccess::default()),
        record_scope: record_scope.into(),
    }
}

#[test]
fn admins_and_full_team_staff_have_team_scope() {
    for (role, scope) in [
        ("admin", "assigned"),
        ("super-admin", "assigned"),
        ("staff", "team"),
    ] {
        let member = user(role, scope);
        assert!(member.has_team_scope(), "{role}/{scope}");
        assert_eq!(member.record_scope_label(), "team");
    }
}

#[test]
fn assigned_staff_and_unknown_roles_are_assigned_only() {
    for (role, scope) in [
        ("staff", "assigned"),
        ("viewer", "assigned"),
        ("viewer", "team"),
        ("", "team"),
        ("Admin", "assigned"),
    ] {
        let member = user(role, scope);
        assert!(!member.has_team_scope(), "{role}/{scope}");
        assert_eq!(member.record_scope_label(), "assigned");
    }
}
