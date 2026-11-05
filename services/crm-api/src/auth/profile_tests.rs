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
        platform_preset: None,
        platform_access: None,
    }
}

#[test]
fn admins_and_full_team_staff_have_team_scope() {
    for (role, scope) in [("admin", "assigned"), ("staff", "team")] {
        let member = user(role, scope);
        assert!(member.has_team_scope(), "{role}/{scope}");
        assert_eq!(member.record_scope_label(), "team");
    }
}

#[test]
fn assigned_staff_and_unknown_roles_are_assigned_only() {
    for (role, scope) in [
        ("staff", "assigned"),
        ("super-admin", "assigned"),
        ("super-admin", "team"),
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

#[test]
fn the_blaqks_one_profile_holds_no_crm_but_manages_its_own_team() {
    let profile = serde_json::to_value(Profile::from(user("super-admin", "team"))).unwrap();
    assert_eq!(profile["role"], "Blaqks One");
    assert_eq!(profile["managesTeam"], true);
    assert_eq!(profile["recordScope"], "assigned");
    assert!(profile["permissions"]
        .as_object()
        .unwrap()
        .values()
        .all(|grant| grant == false));
    assert!(profile["recordActions"]
        .as_object()
        .unwrap()
        .values()
        .all(|actions| actions.as_object().unwrap().values().all(|on| on == false)));
    assert_eq!(profile["financeAccess"]["scope"], "none");
    assert_eq!(profile["financeAccess"]["teamView"], false);
}

#[test]
fn blaqks_one_team_profiles_carry_their_access_and_no_crm() {
    let mut member = user("platform", "team");
    member.platform_preset = Some("support".into());
    let saved = serde_json::json!({"help_requests": "manage", "companies": "view"});
    member.platform_access = Some(Json(saved.clone()));
    let profile = serde_json::to_value(Profile::from(member)).unwrap();
    assert_eq!(profile["role"], "Blaqks One · Support");
    assert_eq!(profile["roleId"], "platform");
    assert_eq!(profile["managesTeam"], false);
    assert_eq!(profile["recordScope"], "assigned");
    assert_eq!(profile["platformAccess"], saved);
    assert!(profile["permissions"]
        .as_object()
        .unwrap()
        .values()
        .all(|grant| grant == false));
    assert_eq!(profile["financeAccess"]["scope"], "none");
    let access = |role| serde_json::to_value(Profile::from(user(role, "team"))).unwrap();
    let owner = access("super-admin");
    assert_eq!(owner["platformAccess"]["companies"], "manage");
    assert_eq!(owner["platformAccess"]["dashboard"], "view");
    assert_eq!(owner["platformAccess"].as_object().unwrap().len(), 7);
    assert_eq!(access("admin")["platformAccess"], serde_json::json!({}));
    assert_eq!(access("staff")["platformAccess"], serde_json::json!({}));
}
