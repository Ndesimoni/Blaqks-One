//! Member-update normalisation of action grants (A2 §5, L-2, M-D).
use kws_crm_api::{
    auth::{actions::Actions, permissions::Permissions, profile::UserRow},
    team::members::{prepare::prepare, update::UpdateRequest, MemberRow},
};
use serde_json::{json, Value};
use sqlx::types::Json;
use uuid::Uuid;

fn member(role: &str, scope: &str, positions: &[&str], permissions: Permissions) -> MemberRow {
    let actions = match role {
        "staff" => serde_json::to_value(Actions::preset(&permissions)).unwrap(),
        _ => json!({}),
    };
    MemberRow {
        user: UserRow {
            id: Uuid::new_v4(),
            name: "Synthetic".into(),
            email: "synthetic@example.test".into(),
            phone: "+971501234567".into(),
            role: role.into(),
            owner_id: None,
            workspace_id: "workspace".into(),
            positions: Json(positions.iter().map(|p| p.to_string()).collect()),
            permissions: Json(permissions),
            channel_access: Json(Default::default()),
            language: None,
            guidance_enabled: None,
            record_scope: scope.into(),
            actions: Json(actions),
        },
        active: true,
        version: 1,
        accepted: true,
        revoked: false,
        archived: false,
        archived_at: None,
    }
}

fn receptionist(scope: &str) -> MemberRow {
    let modules = Permissions {
        relationships: true,
        schedule: true,
        ..Default::default()
    };
    member("staff", scope, &["receptionist"], modules)
}

fn prepared(current: &MemberRow, body: Value) -> Result<Actions, (u16, &'static str)> {
    let mut request: UpdateRequest = serde_json::from_value(body).unwrap();
    prepare(&mut request, current).map_err(|error| (error.0.as_u16(), error.1))?;
    Ok(request
        .actions
        .expect("staff updates store a complete object")
        .actions)
}

fn view_only() -> Value {
    serde_json::to_value(Actions::default()).unwrap()
}

#[test]
fn positions_never_widen_an_enabled_module_but_preset_a_new_one() {
    let current = receptionist("assigned");
    let viewer = prepared(&current, json!({"version":1,"actions": view_only()})).unwrap();
    assert_eq!(viewer, Actions::default());
    let mut stored = current;
    stored.user.actions = Json(serde_json::to_value(viewer).unwrap());
    let moved = prepared(&stored, json!({"version":1,"positions":["property-agent"]})).unwrap();
    assert!(
        !moved.relationships.create && !moved.schedule.edit,
        "M-D keeps view-only"
    );
    assert!(moved.properties.create && moved.properties.delete_activity);
    assert!(!moved.properties.delete_main);
    let narrowed = prepared(&stored, json!({"version":1,"positions":["accountant"]})).unwrap();
    let modules = Actions {
        finance: Default::default(),
        ..narrowed
    };
    assert_eq!(modules, Actions::default());
    assert!(
        narrowed.finance.create && !narrowed.finance.approve,
        "finance newly on: preset"
    );
}

#[test]
fn delete_main_needs_team_scope_and_scope_loss_clears_it() {
    let mut full = serde_json::to_value(Actions::preset(&Permissions::full())).unwrap();
    full["relationships"]["deleteMain"] = json!(true);
    let assigned = receptionist("assigned");
    let refused = prepared(&assigned, json!({"version":1,"actions": full.clone()})).unwrap_err();
    assert_eq!(
        refused,
        (
            400,
            "Deleting clients, contacts or properties needs whole-team visibility."
        )
    );
    let body = json!({"version":1,"actions": full.clone(),"recordScope":"team"});
    let granted = prepared(&assigned, body).unwrap();
    assert!(granted.relationships.delete_main && !granted.properties.create);
    let mut team = receptionist("team");
    team.user.actions = Json(serde_json::to_value(granted).unwrap());
    let kept = prepared(&team, json!({"version":1,"positions":["lead-manager"]})).unwrap();
    assert!(
        kept.relationships.delete_main,
        "a position change keeps stored grants"
    );
    let lost = prepared(&team, json!({"version":1,"recordScope":"assigned"})).unwrap();
    assert!(!lost.deletes_main() && lost.relationships.create);
    let widened = prepared(&assigned, json!({"version":1,"recordScope":"team"})).unwrap();
    assert!(
        !widened.deletes_main(),
        "a scope change never turns deleteMain on"
    );
}

#[test]
fn admin_targets_refuse_actions_and_keep_an_empty_object() {
    let admin = member("admin", "assigned", &[], Permissions::full());
    let full = serde_json::to_value(Actions::preset(&Permissions::full())).unwrap();
    let mut request: UpdateRequest =
        serde_json::from_value(json!({"version":1,"actions": full})).unwrap();
    let error = prepare(&mut request, &admin).unwrap_err();
    assert_eq!(error.1, "Record actions apply to staff only.");
    let mut plain: UpdateRequest = serde_json::from_value(json!({"version":1})).unwrap();
    prepare(&mut plain, &admin).unwrap();
    assert!(plain.actions.is_none());
    let mut odd = receptionist("assigned");
    odd.user.role = "viewer".into();
    let mut request: UpdateRequest = serde_json::from_value(json!({"version":1})).unwrap();
    assert_eq!(prepare(&mut request, &odd).unwrap_err().0.as_u16(), 403);
}
