use kws_crm_api::records::{
    creation::ensure_id_allowed,
    target::{ensure_client, ensure_update_allowed, ensure_version, Target},
    validation::{validate, validate_new},
    visibility::RecordScope,
};
use serde_json::json;
use uuid::Uuid;

fn task(assignee: Option<Uuid>, holds_client: bool) -> Target {
    Target {
        id: Uuid::new_v4(),
        version: 3,
        legacy_id: "FU-001".into(),
        assignee_id: assignee,
        contact_id: None,
        client_ref: Some("CL-001".into()),
        property_ref: None,
        referral_ref: None,
        holds_client,
    }
}

#[test]
fn create_ids_are_optional_and_only_team_scope_may_type_one() {
    let blank = validate_new("Clients", json!({"client_id":"  ","full_name":"A"})).unwrap();
    assert!(blank.legacy_id.is_empty() && blank.payload.get("client_id").is_none());
    assert!(validate_new("Clients", json!({"full_name":"A"})).is_ok());
    assert!(validate_new("Clients", json!({"client_id":7})).is_err());
    assert!(validate("Clients", json!({"full_name":"A"})).is_err());
    let mut typed = validate_new("Clients", json!({"client_id":" CL-9 "})).unwrap();
    let staff = RecordScope::Assigned(Uuid::new_v4());
    let error = ensure_id_allowed(staff, &typed).unwrap_err();
    assert_eq!(error.1, "Record IDs are issued by the server.");
    assert!(ensure_id_allowed(RecordScope::Team, &typed).is_ok());
    assert!(ensure_id_allowed(staff, &blank).is_ok());
    typed.issue_id("Clients", "CL-010".into()).unwrap();
    assert_eq!(typed.payload["client_id"], "CL-010");
}

#[test]
fn assigned_only_updates_keep_ids_and_direct_assignees_keep_their_client() {
    let me = Uuid::new_v4();
    let scope = RecordScope::Assigned(me);
    let same = validate(
        "Follow-ups",
        json!({"activity_id":"FU-001","client_id":"CL-001"}),
    )
    .unwrap();
    let moved = validate(
        "Follow-ups",
        json!({"activity_id":"FU-001","client_id":"CL-002"}),
    )
    .unwrap();
    let renamed = validate("Follow-ups", json!({"activity_id":"FU-002"})).unwrap();
    let target = task(Some(me), false);
    assert!(ensure_update_allowed(scope, "Follow-ups", &target, &same).is_ok());
    let denied = ensure_update_allowed(scope, "Follow-ups", &target, &moved).unwrap_err();
    assert_eq!(denied.0.as_u16(), 403);
    let ids = ensure_update_allowed(scope, "Follow-ups", &target, &renamed).unwrap_err();
    assert_eq!(ids.1, "Record IDs cannot be changed.");
    assert!(ensure_update_allowed(scope, "Follow-ups", &task(Some(me), true), &moved).is_ok());
    assert!(ensure_update_allowed(scope, "Follow-ups", &task(None, false), &moved).is_ok());
    assert!(ensure_update_allowed(RecordScope::Team, "Follow-ups", &target, &renamed).is_ok());
    assert_eq!(
        ensure_version(&target, 2, "stale").unwrap_err().2,
        "version_conflict"
    );
}

#[test]
fn only_follow_ups_may_lack_a_client_for_assigned_only_staff() {
    let staff = RecordScope::Assigned(Uuid::new_v4());
    let none = Default::default();
    for collection in ["Viewings", "Shortlist", "Interaction log", "Client care"] {
        let error = ensure_client(staff, collection, &none).unwrap_err();
        assert_eq!(error.1, "Choose one of your clients for this record.");
        assert!(ensure_client(RecordScope::Team, collection, &none).is_ok());
    }
    assert!(ensure_client(staff, "Follow-ups", &none).is_ok());
    assert!(ensure_client(staff, "Clients", &none).is_ok());
}
