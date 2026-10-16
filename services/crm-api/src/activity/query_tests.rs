use super::*;
use crate::auth::permissions::{ChannelAccess, Permissions};
use serde_json::json;
use sqlx::types::Json;

fn user(role: &str, scope: &str) -> UserRow {
    UserRow {
        id: Uuid::from_u128(7),
        name: "Member".into(),
        email: "member@example.test".into(),
        phone: "+971500000000".into(),
        role: role.into(),
        owner_id: None,
        workspace_id: "workspace".into(),
        positions: Json(Vec::new()),
        permissions: Json(Permissions::default()),
        channel_access: Json(ChannelAccess::default()),
        record_scope: scope.into(),
        actions: Json(json!({})),
    }
}

fn status(result: ApiResult<impl std::fmt::Debug>) -> u16 {
    result.err().map(|error| error.0.as_u16()).unwrap_or(200)
}

#[test]
fn permission_parameters_are_refused_before_syntax() {
    let me = Uuid::from_u128(7).to_string();
    let staff = user("staff", "assigned");
    let granted = ["Clients"];
    let check =
        |raw: &str, user: &UserRow| status(Params::parse(Some(raw)).authorise(user, &granted));
    assert_eq!(check("kind=team", &staff), 403);
    assert_eq!(check("kind=team", &user("admin", "assigned")), 200);
    assert_eq!(check("actor=not-a-uuid", &staff), 403);
    assert_eq!(check(&format!("actor={me}"), &staff), 200);
    assert_eq!(check("actor=not-a-uuid", &user("staff", "team")), 200);
    assert_eq!(check("collection=Deals&from=bad", &staff), 403);
    assert_eq!(check("collection=Nope", &user("admin", "team")), 403);
    assert_eq!(check("collection=Clients&collection=Deals", &staff), 403);
    assert_eq!(check("collection=Clients&from=bad", &staff), 200);
}

#[test]
fn syntax_and_ranges_are_strict() {
    let today = dates::parse_day("2026-10-16").unwrap();
    let check = |raw: &str| status(Params::parse(Some(raw)).validate(today));
    for bad in [
        "limit=0",
        "limit=101",
        "limit=+5",
        "limit=1000",
        "cursor=abc",
        "from=2026-10-02&to=2026-10-01",
        "from=2025-01-01&to=2026-01-02",
        "from=2026-02-30",
        "kind=other",
        "action=sent",
        "actor=nope",
        "surprise=1",
        "limit=5&limit=6",
    ] {
        assert_eq!(check(bad), 400, "{bad}");
    }
    let defaults = Params::parse(None).validate(today).unwrap();
    assert_eq!(defaults.limit, 50);
    assert_eq!(defaults.days, (today - 89, today));
    assert_eq!(
        check("from=2025-01-01&to=2026-01-01&limit=100&kind=record"),
        200
    );
    let filters = Params::parse(Some("action=access_changed&limit=&collection=Clients"))
        .validate(today)
        .unwrap();
    assert_eq!(filters.action.as_deref(), Some("access_changed"));
    assert_eq!(filters.collection.as_deref(), Some("Clients"));
    assert_eq!(filters.limit, 50);
}
