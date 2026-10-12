use kws_crm_api::{
    auth::{
        permissions::{ChannelAccess, Permissions},
        profile::{Profile, UserRow},
    },
    records::validation::validate,
    team::members::{
        update::{prepare, UpdateRequest},
        MemberRow,
    },
};
use serde_json::{json, Value};
use sqlx::types::Json;
use uuid::Uuid;

fn user(role: &str, record_scope: &str) -> UserRow {
    UserRow {
        id: Uuid::new_v4(),
        name: "Synthetic".into(),
        email: "synthetic@example.test".into(),
        phone: "+971501234567".into(),
        role: role.into(),
        owner_id: (role == "staff").then(Uuid::new_v4),
        workspace_id: "workspace".into(),
        positions: Json(if role == "staff" {
            vec!["receptionist".into()]
        } else {
            vec![]
        }),
        permissions: Json(Permissions::default()),
        channel_access: Json(ChannelAccess::default()),
        record_scope: record_scope.into(),
    }
}

fn member(role: &str) -> MemberRow {
    MemberRow {
        user: user(role, "assigned"),
        active: true,
        version: 1,
        accepted: true,
        revoked: false,
        archived: false,
        archived_at: None,
    }
}

fn request(body: Value) -> UpdateRequest {
    serde_json::from_value(body).unwrap()
}

#[test]
fn assignment_and_projection_keys_are_reserved_in_record_payloads() {
    for key in [
        "assignee",
        "assigneeId",
        "assignee_id",
        "record_scope",
        "recordScope",
        "references",
        "taskClients",
        "listingViewings",
    ] {
        let mut payload = json!({"client_id":"CL-1"});
        payload[key] = json!(null);
        let error = validate("Clients", payload).err().expect(key);
        assert_eq!(error.0.as_u16(), 400, "{key}");
        assert_eq!(
            error.1,
            "Server ownership and publication fields cannot be set."
        );
    }
    assert!(validate("Clients", json!({"client_id":"CL-1","assigned_to":"x"})).is_ok());
}

#[test]
fn profiles_report_team_scope_for_admins_and_the_grant_for_staff() {
    let scope = |role: &str, value: &str| Profile::from(user(role, value)).record_scope;
    assert_eq!(scope("admin", "assigned"), "team");
    assert_eq!(scope("super-admin", "assigned"), "team");
    assert_eq!(scope("staff", "assigned"), "assigned");
    assert_eq!(scope("staff", "team"), "team");
    assert!(!user("staff", "assigned").has_team_scope());
    let encoded = serde_json::to_value(Profile::from(user("staff", "team"))).unwrap();
    assert_eq!(encoded["recordScope"], "team");
}

#[test]
fn record_scope_requests_accept_only_known_values_for_staff_targets() {
    let base = json!({"version":1});
    let mut team = base.clone();
    team["recordScope"] = json!("team");
    let mut granted = request(team.clone());
    assert!(prepare(&mut granted, &member("staff")).is_ok());
    assert_eq!(granted.record_scope.map(|s| s.as_str()), Some("team"));
    let error = prepare(&mut request(team), &member("admin")).err().unwrap();
    assert_eq!(error.0.as_u16(), 400);
    assert_eq!(error.1, "Full-team access applies to staff only.");
    let mut omitted = request(base.clone());
    assert!(prepare(&mut omitted, &member("admin")).is_ok());
    assert!(omitted.record_scope.is_none());
    for invalid in [json!("Team"), json!("everyone"), json!(true), json!(null)] {
        let mut body = base.clone();
        body["recordScope"] = invalid.clone();
        let parsed = serde_json::from_value::<UpdateRequest>(body);
        assert!(invalid.is_null() || parsed.is_err(), "{invalid}");
    }
}

#[test]
fn position_changes_never_set_the_record_scope() {
    let mut changed = request(json!({"version":1,"positions":["receptionist"]}));
    assert!(prepare(&mut changed, &member("staff")).is_ok());
    assert!(changed.record_scope.is_none());
}
