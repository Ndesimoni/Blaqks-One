//! Member-update handling of the finance action key (finance-design §5.1, §13 L-F1).
use kws_crm_api::{
    auth::{actions::Actions, permissions::Permissions, profile::UserRow},
    team::members::{prepare::prepare, update::UpdateRequest, MemberRow},
};
use serde_json::{json, Value};
use sqlx::types::Json;
use uuid::Uuid;

fn agent(scope: &str, finance: Value) -> MemberRow {
    let permissions = Permissions {
        relationships: true,
        properties: true,
        schedule: true,
        finance: true,
        reports: true,
        exports: false,
    };
    let mut actions = serde_json::to_value(Actions::preset(&permissions)).unwrap();
    actions["finance"] = finance;
    MemberRow {
        user: UserRow {
            id: Uuid::new_v4(),
            name: "Synthetic".into(),
            email: "synthetic@example.test".into(),
            phone: "+971501234567".into(),
            role: "staff".into(),
            owner_id: None,
            workspace_id: "workspace".into(),
            positions: Json(vec!["property-agent".into()]),
            permissions: Json(permissions),
            channel_access: Json(Default::default()),
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

fn prepared(current: &MemberRow, body: Value) -> Result<Actions, (u16, &'static str)> {
    let mut request: UpdateRequest = serde_json::from_value(body).unwrap();
    prepare(&mut request, current).map_err(|error| (error.0.as_u16(), error.1))?;
    Ok(request
        .actions
        .expect("staff updates store actions")
        .actions)
}

fn flags(approve: bool, team_view: bool) -> Value {
    json!({"create":true,"edit":true,"assign":true,"approve":approve,"teamView":team_view})
}

fn body(current: &MemberRow, finance: Option<Value>, scope: Option<&str>) -> Value {
    let mut actions = current.user.actions.0.clone();
    match finance {
        Some(finance) => actions["finance"] = finance,
        None => drop(actions.as_object_mut().unwrap().remove("finance")),
    }
    let mut body = json!({"version":1,"actions":actions});
    if let Some(scope) = scope {
        body["recordScope"] = json!(scope);
    }
    body
}

#[test]
fn team_view_and_approve_need_whole_team_scope_and_each_other() {
    let assigned = agent("assigned", flags(false, false));
    let refused = prepared(&assigned, body(&assigned, Some(flags(false, true)), None));
    assert_eq!(
        refused.unwrap_err(),
        (
            400,
            "Approving and team finance need whole-team visibility."
        )
    );
    let team = agent("team", flags(false, false));
    let refused = prepared(&team, body(&team, Some(flags(true, false)), None));
    assert_eq!(
        refused.unwrap_err(),
        (400, "Approving finance records needs See team finance.")
    );
    let granted = prepared(&team, body(&team, Some(flags(true, true)), None)).unwrap();
    assert!(granted.finance.approve && granted.finance.team_view);
    let widened = prepared(
        &assigned,
        body(&assigned, Some(flags(true, true)), Some("team")),
    );
    assert!(widened.unwrap().finance.approve);
}

#[test]
fn an_omitted_finance_key_is_carried_over_and_scope_loss_clears_team_view() {
    let approver = agent("team", flags(true, true));
    let kept = prepared(&approver, body(&approver, None, None)).unwrap();
    assert!(kept.finance.approve && kept.finance.team_view);
    let narrowed = prepared(&approver, body(&approver, None, Some("assigned"))).unwrap();
    assert!(narrowed.finance.create && !narrowed.finance.team_view && !narrowed.finance.approve);
    let plain = prepared(&approver, json!({"version":1,"recordScope":"assigned"})).unwrap();
    assert!(!plain.finance.team_view && !plain.finance.approve);
    let positions = json!({"version":1,"positions":["receptionist"]});
    let off = prepared(&approver, positions).unwrap();
    assert_eq!(
        off.finance,
        Default::default(),
        "no finance module, no finance flags"
    );
}
