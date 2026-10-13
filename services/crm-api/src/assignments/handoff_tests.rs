use super::*;
use crate::auth::permissions::Permissions;
use axum::http::StatusCode;
use serde_json::json;
use sqlx::types::Json;

const ME: Uuid = Uuid::from_u128(1);
const OTHER: Uuid = Uuid::from_u128(2);

fn task(client: Option<&str>, holds_client: bool) -> Target {
    Target {
        id: Uuid::from_u128(9),
        version: 1,
        legacy_id: "FU-001".into(),
        assignee_id: Some(ME),
        contact_id: None,
        client_ref: client.map(Into::into),
        property_ref: None,
        referral_ref: None,
        holds_client,
    }
}

fn message(result: ApiResult<()>) -> &'static str {
    let error = result.expect_err("expected a refusal");
    assert_eq!(error.0, StatusCode::FORBIDDEN);
    assert_eq!(error.2, "forbidden");
    error.1
}

#[test]
fn non_holding_assignee_may_only_return_a_client_linked_follow_up() {
    let mine = RecordScope::Assigned(ME);
    let linked = task(Some("CL-001"), false);
    assert!(ensure_target(mine, "Follow-ups", &linked, None).is_ok());
    for to in [OTHER, ME] {
        let refused = ensure_target(mine, "Follow-ups", &linked, Some(to));
        assert_eq!(message(refused), CHAIN_DENIED);
    }
}

#[test]
fn client_holders_and_team_scope_keep_passing_follow_ups_on() {
    let held = task(Some("CL-001"), true);
    assert!(ensure_target(RecordScope::Assigned(ME), "Follow-ups", &held, Some(OTHER)).is_ok());
    let queued = ensure_target(RecordScope::Assigned(ME), "Follow-ups", &held, None);
    assert_eq!(message(queued), QUEUE_DENIED);
    let linked = task(Some("CL-001"), false);
    for to in [Some(OTHER), None] {
        assert!(ensure_target(RecordScope::Team, "Follow-ups", &linked, to).is_ok());
    }
}

#[test]
fn client_less_follow_ups_and_parents_never_reach_the_queue_from_staff() {
    let mine = RecordScope::Assigned(ME);
    let loose = task(None, false);
    assert!(ensure_target(mine, "Follow-ups", &loose, Some(OTHER)).is_ok());
    assert_eq!(
        message(ensure_target(mine, "Follow-ups", &loose, None)),
        QUEUE_DENIED
    );
    let client = task(Some("CL-001"), false);
    assert_eq!(
        message(ensure_target(mine, "Clients", &client, None)),
        QUEUE_DENIED
    );
    assert_eq!(message(ensure_queue(mine, "Contacts", None)), QUEUE_DENIED);
    assert!(ensure_queue(mine, "Follow-ups", None).is_ok());
    assert!(ensure_queue(RecordScope::Team, "Clients", None).is_ok());
}

#[test]
fn without_assign_only_the_direct_assignee_may_return_a_linked_follow_up() {
    let mine = RecordScope::Assigned(ME);
    let linked = task(Some("CL-001"), false);
    assert!(ensure_return(mine, &linked, None).is_ok());
    assert_eq!(
        message(ensure_return(mine, &linked, Some(OTHER))),
        ASSIGN_DENIED
    );
    for refused in [
        ensure_return(RecordScope::Team, &linked, None),
        ensure_return(RecordScope::Assigned(OTHER), &linked, None),
        ensure_return(mine, &task(Some("CL-001"), true), None),
        ensure_return(mine, &task(None, false), None),
    ] {
        assert_eq!(message(refused), ASSIGN_DENIED);
    }
}

fn staff_without_assign() -> UserRow {
    UserRow {
        id: ME,
        name: "Viewer".into(),
        email: "viewer@example.test".into(),
        phone: "+971500000000".into(),
        role: "staff".into(),
        owner_id: Some(OTHER),
        workspace_id: "workspace".into(),
        positions: Json(vec![]),
        permissions: Json(Permissions::full()),
        channel_access: Json(Default::default()),
        record_scope: "team".into(),
        actions: Json(json!({"relationships": {"create": true}})),
    }
}

#[test]
fn the_assign_grant_is_required_except_for_a_possible_follow_up_return() {
    let viewer = staff_without_assign();
    for (collection, may_return) in [("Clients", true), ("Follow-ups", false)] {
        let refused = ensure_assign_grant(&viewer, collection, may_return);
        assert_eq!(message(refused), ASSIGN_DENIED);
    }
    assert!(ensure_assign_grant(&viewer, "Follow-ups", true).is_ok());
    let mut agent = viewer;
    agent.actions = Json(json!({"relationships": {"assign": true}}));
    assert!(ensure_assign_grant(&agent, "Clients", false).is_ok());
}
