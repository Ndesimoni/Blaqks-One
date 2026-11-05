use super::*;
use crate::auth::permissions::{ChannelAccess, Permissions};
use crate::workspaces::platform::presets::{Preset, PRESETS};
use serde_json::json;
use sqlx::types::Json;
use uuid::Uuid;

fn user(role: &str, access: Option<serde_json::Value>) -> UserRow {
    UserRow {
        id: Uuid::nil(),
        name: "Member".into(),
        email: "member@example.test".into(),
        phone: "+971500000000".into(),
        role: role.into(),
        owner_id: None,
        workspace_id: "super-admin-workspace".into(),
        positions: Json(Vec::new()),
        permissions: Json(Permissions::default()),
        channel_access: Json(ChannelAccess::default()),
        record_scope: "assigned".into(),
        actions: Json(json!({})),
        language: None,
        guidance_enabled: None,
        platform_preset: None,
        platform_access: access.map(Json),
    }
}

fn map(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
    pairs
        .iter()
        .map(|(area, level)| ((*area).into(), (*level).into()))
        .collect()
}

#[test]
fn levels_are_checked_against_the_fixed_table() {
    let chosen = checked(&map(&[("marketplace", "view"), ("companies", "manage")]));
    assert_eq!(
        chosen,
        Ok(vec![
            (Area::Companies, Level::Manage),
            (Area::Marketplace, Level::View)
        ])
    );
    assert_eq!(checked(&map(&[("records", "view")])), Err(UNKNOWN));
    assert_eq!(
        checked(&map(&[("company_controls", "manage")])),
        Err(UNKNOWN)
    );
    assert_eq!(checked(&map(&[("dashboard", "manage")])), Err(LEVEL));
    assert_eq!(checked(&map(&[("invite_admins", "view")])), Err(LEVEL));
    assert_eq!(checked(&map(&[("companies", "off")])), Err(LEVEL));
    assert_eq!(checked(&map(&[("Companies", "view")])), Err(UNKNOWN));
    assert_eq!(checked(&BTreeMap::new()), Err(EMPTY));
}

#[test]
fn positions_fill_the_owner_decided_levels() {
    let manager = Preset::Manager.access();
    assert_eq!(manager.len(), ALL.len());
    assert!(manager.contains(&(Area::Dashboard, Level::View)));
    assert!(manager.contains(&(Area::InviteAdmins, Level::Manage)));
    assert!(manager.contains(&(Area::Companies, Level::Manage)));
    assert_eq!(
        to_map(&Preset::Sales.access()),
        BTreeMap::from([("clients", "manage"), ("companies", "view")])
    );
    assert_eq!(
        to_map(&Preset::Support.access()),
        BTreeMap::from([("companies", "view"), ("help_requests", "manage")])
    );
    assert_eq!(
        Preset::Analyst.access(),
        vec![(Area::Dashboard, Level::View)]
    );
    for preset in PRESETS {
        assert_eq!(Preset::parse(preset.key()), Some(preset));
        let filled = to_map(&preset.access());
        let typed: BTreeMap<String, String> = filled
            .iter()
            .map(|(area, level)| ((*area).into(), (*level).into()))
            .collect();
        assert!(preset == Preset::Custom || checked(&typed).is_ok());
    }
    assert_eq!(Preset::parse("platform_admin"), None);
}

#[test]
fn the_owner_holds_everything_and_staff_only_their_saved_levels() {
    let owner = user("super-admin", None);
    assert!(ALL
        .into_iter()
        .all(|area| allows(&owner, area, area.highest())));
    let saved = json!({"companies": "view", "dashboard": "manage", "retired": "view"});
    let member = user("platform", Some(saved));
    assert_eq!(granted(&member), vec![(Area::Companies, Level::View)]);
    assert!(allows(&member, Area::Companies, Level::View));
    assert!(!allows(&member, Area::Companies, Level::Manage));
    assert!(!allows(&member, Area::Dashboard, Level::View));
    let manager = user("platform", Some(json!({"companies": "manage"})));
    assert!(
        allows(&manager, Area::Companies, Level::View),
        "manage includes view"
    );
    assert!(granted(&user("platform", None)).is_empty());
    for role in ["admin", "staff", "viewer", ""] {
        let company = user(role, Some(json!({"companies": "manage"})));
        assert!(granted(&company).is_empty(), "{role}");
    }
}
