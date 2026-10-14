use super::*;
use serde_json::json;

fn modules(relationships: bool, properties: bool, schedule: bool) -> Permissions {
    Permissions {
        relationships,
        properties,
        schedule,
        ..Default::default()
    }
}

#[test]
fn request_decoder_is_strict_and_invitations_may_omit_delete_main() {
    let preset = serde_json::to_value(Actions::preset(&modules(true, true, true))).unwrap();
    assert_eq!(
        preset["relationships"],
        json!({"create":true,"edit":true,"assign":true,"deleteMain":false})
    );
    assert!(preset["schedule"].get("deleteMain").is_none());
    assert!(serde_json::from_value::<Actions>(preset.clone()).is_ok());
    for broken in [
        json!({"relationships": preset["relationships"], "properties": preset["properties"]}),
        json!({"relationships":{"create":true,"edit":true,"assign":true}, "properties": preset["properties"], "schedule": preset["schedule"]}),
        json!({"relationships":{"create":"yes","edit":true,"assign":true,"deleteMain":false}, "properties": preset["properties"], "schedule": preset["schedule"]}),
        json!({"relationships":{"create":true,"edit":true,"assign":true,"deleteMain":false,"deleteActivity":true}, "properties": preset["properties"], "schedule": preset["schedule"]}),
        json!({"relationships": preset["relationships"], "properties": preset["properties"], "schedule": preset["schedule"], "finance": {}}),
    ] {
        assert!(serde_json::from_value::<Actions>(broken).is_err());
    }
    let invite = json!({"relationships":{"create":true,"edit":false,"assign":true},
        "properties":{"create":true,"edit":true,"assign":true,"deleteActivity":false},
        "schedule":{"create":false,"edit":false,"assign":false,"deleteActivity":false}});
    let decoded = Actions::from_invitation(invite.clone()).unwrap();
    assert!(!decoded.relationships.edit && !decoded.deletes_main());
    let mut sneaky = invite.clone();
    sneaky["properties"]["deleteMain"] = json!(true);
    assert!(Actions::from_invitation(sneaky).unwrap().deletes_main());
    let mut unknown = invite;
    unknown["schedule"]["deleteMain"] = json!(false);
    assert!(Actions::from_invitation(unknown).is_none());
}

#[test]
fn stored_decoder_is_lenient_and_never_fails() {
    for malformed in [
        json!(null),
        json!([]),
        json!("x"),
        json!({"relationships": "yes"}),
        json!({"relationships": {"create": 1, "edit": "true", "assign": null}}),
    ] {
        assert_eq!(Actions::from_stored(&malformed), Actions::default());
    }
    let stored = Actions::from_stored(&json!({"schedule":{"edit":true,"deleteMain":true},"x":1}));
    assert!(stored.schedule.edit && !stored.schedule.delete_main && !stored.schedule.create);
}

#[test]
fn normalising_clears_modules_that_are_off_and_delete_main_without_team_scope() {
    let mut actions = Actions::preset(&modules(true, true, true));
    actions.relationships.delete_main = true;
    actions.properties.delete_main = true;
    let narrowed = actions.normalised(&modules(true, false, true), false);
    assert_eq!(narrowed.properties, ModuleActions::default());
    assert!(narrowed.relationships.create && !narrowed.relationships.delete_main);
    assert!(actions
        .normalised(&modules(true, true, true), true)
        .deletes_main());
}
