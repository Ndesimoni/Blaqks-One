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
        actions: Json(serde_json::json!({})),
        language: None,
        guidance_enabled: None,
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

#[test]
fn profiles_expose_only_an_allowlisted_own_language() {
    let shown = |language: Option<&str>| {
        let mut member = user("staff", "assigned");
        member.language = language.map(Into::into);
        serde_json::to_value(Profile::from(member)).unwrap()
    };
    assert_eq!(shown(Some("ar"))["language"], "ar");
    assert_eq!(shown(Some("en"))["language"], "en");
    assert_eq!(shown(Some("fr"))["language"], "en");
    // Team directory rows carry no language, so the field is left out entirely.
    assert!(shown(None).get("language").is_none());
}

#[test]
fn profiles_expose_guidance_only_on_own_account_payloads() {
    let shown = |enabled: Option<bool>| {
        let mut member = user("admin", "team");
        member.guidance_enabled = enabled;
        serde_json::to_value(Profile::from(member)).unwrap()
    };
    assert_eq!(shown(Some(true))["guidanceEnabled"], true);
    assert_eq!(shown(Some(false))["guidanceEnabled"], false);
    // Team directory rows omit the preference entirely.
    assert!(shown(None).get("guidanceEnabled").is_none());
}
