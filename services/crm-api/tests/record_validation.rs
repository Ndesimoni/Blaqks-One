use kws_crm_api::records::validation::validate;
use serde_json::json;

#[test]
fn preserves_private_metadata_and_media_while_normalizing_legacy_id() {
    let value = json!({"property_id":" PR-1 ","private_extra":{"note":"retained"},
        "media_photos":[{"name":"photo","src":"data:image/jpeg;base64,AAA="}]});
    let record = validate("Properties", value).unwrap();
    assert_eq!(record.legacy_id, "PR-1");
    assert_eq!(record.payload["property_id"], "PR-1");
    assert_eq!(record.payload["private_extra"]["note"], "retained");
    assert_eq!(record.payload["media_photos"][0]["name"], "photo");
}

#[test]
fn rejects_missing_ids_nonobjects_and_forged_server_fields() {
    for payload in [
        json!(null),
        json!([]),
        json!({}),
        json!({"client_id":"  "}),
        json!({"client_id":"CL-1","workspace_id":"someone-else"}),
        json!({"client_id":"CL-1","approval":true}),
    ] {
        assert!(validate("Clients", payload).is_err());
    }
    assert!(validate("Unknown", json!({"client_id":"CL-1"})).is_err());
}

#[test]
fn rejects_nested_values_for_rendered_workbook_fields() {
    for value in [json!({"malicious":true}), json!(["unexpected"])] {
        assert!(validate(
            "Properties",
            json!({"property_id":"PR-1", "listing_title":value})
        )
        .is_err());
        assert!(validate("Clients", json!({"client_id":"CL-1", "full_name":value})).is_err());
        assert!(validate("Contacts", json!({"contact_id":"CT-1", "phone":value})).is_err());
    }
}
