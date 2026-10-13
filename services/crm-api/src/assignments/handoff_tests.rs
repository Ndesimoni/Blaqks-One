use super::*;
use axum::http::StatusCode;

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
