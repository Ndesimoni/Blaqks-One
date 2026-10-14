use super::*;
use crate::auth::profile::UserRow;
use crate::auth::{actions::Actions, permissions::Permissions};
use serde_json::json;
use sqlx::types::Json;
use uuid::Uuid;

const COLLECTIONS: [&str; 8] = [
    "Clients",
    "Contacts",
    "Properties",
    "Follow-ups",
    "Viewings",
    "Shortlist",
    "Interaction log",
    "Client care",
];

fn modules(relationships: bool, properties: bool, schedule: bool) -> Permissions {
    Permissions {
        relationships,
        properties,
        schedule,
        ..Default::default()
    }
}

fn user(role: &str, scope: &str, permissions: Permissions, actions: Value) -> UserRow {
    UserRow {
        id: Uuid::nil(),
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
        actions: Json(actions),
    }
}

fn full_staff(scope: &str) -> UserRow {
    let all = modules(true, true, true);
    let mut actions = serde_json::to_value(Actions::preset(&all)).unwrap();
    actions["relationships"]["deleteMain"] = json!(true);
    actions["properties"]["deleteMain"] = json!(true);
    user("staff", scope, all, actions)
}

#[test]
fn admins_can_everything_and_unknown_roles_nothing() {
    for role in ["admin", "super-admin"] {
        let admin = user(role, "assigned", Permissions::default(), json!({}));
        for collection in COLLECTIONS {
            for action in [Action::Create, Action::Edit, Action::Delete] {
                assert!(admin.can(collection, action), "{role} {collection}");
            }
        }
        assert_eq!(
            admin.profile_actions(),
            serde_json::to_value(Actions::full()).unwrap()
        );
    }
    let full = full_staff("team");
    for role in ["viewer", "", "Admin", "STAFF", "owner"] {
        let mut odd = full.clone();
        odd.role = role.into();
        assert!(!odd.can_collection("Clients"), "{role}");
        assert_eq!(odd.effective_actions(), Actions::default());
        assert!(odd
            .record_actions()
            .values()
            .all(|a| *a == Default::default()));
    }
}

#[test]
fn staff_parents_need_team_scope_delete_main_and_reference_coverage() {
    let team = full_staff("team");
    assert!(team.can("Clients", Action::Delete) && team.can("Contacts", Action::Delete));
    assert!(!full_staff("assigned").can("Clients", Action::Delete));
    let mut no_schedule = team.clone();
    no_schedule.permissions.0.schedule = false;
    assert!(!no_schedule.can("Clients", Action::Delete));
    assert!(!no_schedule.can("Properties", Action::Delete));
    assert!(no_schedule.can("Contacts", Action::Delete));
    let mut no_properties = team.clone();
    no_properties.permissions.0.properties = false;
    assert!(!no_properties.can("Contacts", Action::Delete));
    assert!(!team.can("Viewings", Action::Assign) && team.can("Follow-ups", Action::Assign));
    assert_eq!(Action::Assign.denied().1, ASSIGN_DENIED);
    assert_eq!(
        Action::Delete.denied().1,
        "Ask your Admin to delete this record."
    );
}

#[test]
fn archived_staff_without_recorded_actions_show_an_empty_object() {
    let archived = user("staff", "assigned", modules(true, true, true), json!({}));
    assert!(!archived.actions_recorded());
    assert_eq!(archived.profile_actions(), json!({}));
    assert!(archived
        .record_actions()
        .values()
        .all(|a| !a.create && !a.delete));
    let viewer = user(
        "staff",
        "team",
        modules(true, false, false),
        json!({"relationships":{}}),
    );
    assert!(viewer.actions_recorded() && viewer.can_collection("Clients"));
    assert!(viewer.ensure("Clients", Action::Edit).is_err());
    assert_eq!(
        viewer.ensure("Viewings", Action::Edit).unwrap_err().1,
        "Access denied."
    );
}
