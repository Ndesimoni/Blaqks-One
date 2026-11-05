use super::*;

fn viewer(team: bool) -> Viewer {
    let id = Uuid::from_u128(7);
    Viewer {
        id,
        caller: (!team).then_some(id),
        whatsapp: true,
        email: false,
        manager: team,
    }
}

#[test]
fn changes_are_strict() {
    let change = parse(json!({"expectedVersion": 3, "state": "resolved"})).unwrap();
    assert_eq!(change.state.as_deref(), Some("resolved"));
    assert_eq!(change.assignee, None);
    let unassign = parse(json!({"expectedVersion": 1, "assigneeId": null})).unwrap();
    assert_eq!(unassign.assignee, Some(None));
    for bad in [
        json!({"expectedVersion": 1}),
        json!({"state": "open"}),
        json!({"expectedVersion": 0, "state": "open"}),
        json!({"expectedVersion": 1, "state": "spam"}),
        json!({"expectedVersion": 1, "state": "new"}),
        json!({"expectedVersion": 1, "assigneeId": 5}),
        json!({"expectedVersion": 1, "assigneeId": "not-a-uuid"}),
        json!({"expectedVersion": 1, "state": "open", "body": "x"}),
        json!([1]),
    ] {
        assert!(parse(bad.clone()).is_err(), "{bad}");
    }
}

#[test]
fn assigned_only_staff_may_only_claim_or_release() {
    let me = viewer(false);
    let other = Some(Uuid::from_u128(9));
    assert!(may_assign(&me, None, Some(me.id)));
    assert!(may_assign(&me, Some(me.id), None));
    assert!(!may_assign(&me, None, other));
    assert!(!may_assign(&me, Some(me.id), other));
    assert!(!may_assign(&me, other, Some(me.id)));
    let team = viewer(true);
    assert!(may_assign(&team, other, Some(team.id)));
    assert!(may_assign(&team, Some(team.id), other));
}
