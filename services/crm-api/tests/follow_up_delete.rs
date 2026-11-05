//! The direct-assignee delete rule (action-permissions §13 item 5).
use kws_crm_api::records::{
    target::{ensure_delete_allowed, Target},
    visibility::RecordScope,
};
use uuid::Uuid;

#[test]
fn direct_assignees_cannot_delete_a_follow_up_whose_client_they_do_not_hold() {
    let me = Uuid::new_v4();
    let follow_up = |assignee: Option<Uuid>, client: Option<&str>, holds_client| Target {
        id: Uuid::new_v4(),
        version: 1,
        legacy_id: "FU-001".into(),
        assignee_id: assignee,
        contact_id: None,
        client_ref: client.map(Into::into),
        property_ref: None,
        referral_ref: None,
        deal_ref: None,
        holds_client,
    };
    let mine = RecordScope::Assigned(me);
    let error = ensure_delete_allowed(
        mine,
        "Follow-ups",
        &follow_up(Some(me), Some("CL-1"), false),
    )
    .unwrap_err();
    assert_eq!(
        (error.0.as_u16(), error.1),
        (
            403,
            "Only the client's holder, the Admin or a full-team member can delete this follow-up."
        )
    );
    for (scope, target) in [
        (mine, follow_up(Some(me), Some("CL-1"), true)),
        (mine, follow_up(Some(me), None, false)),
        (mine, follow_up(None, Some("CL-1"), true)),
        (RecordScope::Team, follow_up(Some(me), Some("CL-1"), false)),
    ] {
        assert!(ensure_delete_allowed(scope, "Follow-ups", &target).is_ok());
    }
}
