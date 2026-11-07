//! The `finance` action key on the wire (finance-design §5.1): strict when present,
//! optional in member PATCHes, and invitations may omit approve and teamView.
use kws_crm_api::auth::{
    actions::Actions, actions_request::ActionsRequest, permissions::Permissions,
};
use serde_json::json;

fn finance(on: bool) -> Permissions {
    Permissions {
        finance: on,
        ..Default::default()
    }
}

#[test]
fn the_wire_is_strict_when_present_and_optional_in_requests() {
    let base = serde_json::to_value(Actions::preset(&finance(true))).unwrap();
    assert_eq!(
        base["finance"],
        json!({"create":true,"edit":true,"assign":true,"approve":false,"teamView":false})
    );
    let decoded: ActionsRequest = serde_json::from_value(base.clone()).unwrap();
    assert!(decoded.finance_given && decoded.actions.finance.create);
    let mut omitted = base.clone();
    omitted.as_object_mut().unwrap().remove("finance");
    let decoded: ActionsRequest = serde_json::from_value(omitted).unwrap();
    assert!(!decoded.finance_given);
    for broken in [
        json!({}),
        json!({"create":true}),
        json!({"create":true,"edit":true,"assign":true,"approve":false,"teamView":"no"}),
        json!({"create":true,"edit":true,"assign":true,"approve":false,"teamView":false,"x":1}),
    ] {
        let mut value = base.clone();
        value["finance"] = broken;
        assert!(serde_json::from_value::<ActionsRequest>(value).is_err());
    }
}

#[test]
fn invitations_may_omit_approve_and_team_view() {
    let mut invite = serde_json::to_value(Actions::preset(&finance(true))).unwrap();
    invite["finance"] = json!({"create":true,"edit":false,"assign":true});
    let decoded = Actions::from_invitation(invite.clone()).unwrap();
    assert!(decoded.finance.create && !decoded.finance.edit && !decoded.finance.team_view);
    invite["finance"]["teamView"] = json!(true);
    assert!(
        Actions::from_invitation(invite.clone())
            .unwrap()
            .finance
            .team_view
    );
    invite["finance"]["extra"] = json!(false);
    assert!(Actions::from_invitation(invite).is_none());
}
