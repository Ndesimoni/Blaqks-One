use kws_crm_api::{
    imports::{
        model::ImportRecords,
        planning::plan,
        snapshot::{fingerprint, TargetRow},
    },
    records::collections::COLLECTIONS,
};
use serde_json::json;
use uuid::Uuid;

/// Fills every collection the test leaves out, as the browser client does.
fn complete(value: serde_json::Value) -> ImportRecords {
    let mut records = serde_json::from_value::<ImportRecords>(value).unwrap();
    for collection in COLLECTIONS {
        records.0.entry(collection.name.into()).or_default();
    }
    records
}

fn source(value: serde_json::Value) -> ImportRecords {
    complete(value).normalize().unwrap()
}

fn target(collection: &str, id: &str, payload: serde_json::Value) -> TargetRow {
    TargetRow {
        id: Uuid::new_v4(),
        version: 1,
        collection: collection.into(),
        legacy_id: id.into(),
        payload,
    }
}

#[test]
fn skips_identical_records_and_preserves_new_private_fields() {
    let row = json!({"contact_id":"CT-1","full_name":"Existing"});
    let existing = vec![target("Contacts", "CT-1", row.clone())];
    let input = source(
        json!({"Clients":[{"client_id":" CL-1 ","extra":{"code":12}}],
        "Contacts":[row],"Properties":[{"property_id":"PR-1","contact_id":"CT-1"}]}),
    );
    let plan = plan(input, &existing).unwrap();
    assert_eq!(plan.skipped["Contacts"], 1);
    assert_eq!(plan.counts["Clients"], 1);
    assert_eq!(plan.counts["Properties"], 1);
    assert_eq!(plan.records.rows("Clients")[0]["client_id"], "CL-1");
    assert_eq!(plan.records.rows("Clients")[0]["extra"]["code"], 12);
}

#[test]
fn conflicting_records_and_missing_contacts_block_whole_plan() {
    let existing = vec![target(
        "Contacts",
        "CT-1",
        json!({"contact_id":"CT-1","full_name":"First"}),
    )];
    let input = source(
        json!({"Clients":[],"Contacts":[{"contact_id":"CT-1","full_name":"Different"}],
        "Properties":[]}),
    );
    let error = match plan(input, &existing) {
        Ok(_) => panic!("expected conflict"),
        Err(error) => error,
    };
    assert_eq!(error.2, "import_conflict");
    let input = source(
        json!({"Clients":[],"Contacts":[],"Properties":[{"property_id":"PR-1","contact_id":"CT-OTHER"}]}),
    );
    assert!(plan(input, &existing).is_err());
}

#[test]
fn linked_contacts_can_arrive_in_same_import() {
    let input = source(json!({"Clients":[],"Contacts":[{"contact_id":"CT-1"}],
        "Properties":[{"property_id":"PR-1","contact_id":"CT-1"}]}));
    let plan = plan(input, &[]).unwrap();
    assert_eq!(plan.counts["Contacts"], 1);
    assert_eq!(plan.counts["Properties"], 1);
    assert_eq!(plan.records.collections()[0].0, "Contacts");
}

#[test]
fn workflow_links_resolve_against_target_and_same_import() {
    let existing = vec![target("Properties", "PR-1", json!({"property_id":"PR-1"}))];
    let input = source(json!({"Clients":[{"client_id":"CL-1"}],
        "Viewings":[{"viewing_id":"VW-1","client_id":"CL-1","property_id":"PR-1"}],
        "Client care":[{"care_id":"CC-1","client_id":"CL-1","property_id_optional":""}]}));
    let plan = plan(input, &existing).unwrap();
    assert_eq!(plan.counts["Viewings"], 1);
    assert_eq!(plan.counts["Client care"], 1);
    assert_eq!(plan.counts["Follow-ups"], 0);
    for missing in [
        json!({"Follow-ups":[{"activity_id":"FU-1","client_id":"CL-MISSING"}]}),
        json!({"Interaction log":[{"log_id":"LG-1","property_id_optional":"PR-MISSING"}]}),
    ] {
        assert!(plan_fails(source(missing), &existing));
    }
}

fn plan_fails(input: ImportRecords, existing: &[TargetRow]) -> bool {
    plan(input, existing).is_err()
}

#[test]
fn rejects_duplicate_source_ids_and_oversized_row_counts() {
    let duplicate = complete(json!({"Clients":[{"client_id":"CL-1"},{"client_id":" CL-1 "}]}));
    assert!(duplicate.normalize().is_err());
    let partial = json!({"Clients":[],"Contacts":[],"Properties":[]});
    let partial = serde_json::from_value::<ImportRecords>(partial).unwrap();
    assert!(partial.normalize().is_err());
    let clients = (0..1001)
        .map(|id| json!({"client_id":format!("CL-{id}")}))
        .collect();
    let mut oversized = complete(json!({}));
    oversized.0.insert("Clients".into(), clients);
    assert!(oversized.normalize().is_err());
    let mut unknown = complete(json!({}));
    unknown
        .0
        .insert("Deals".into(), vec![json!({"deal_id":"DL-1"})]);
    assert!(unknown.normalize().is_err());
}

#[test]
fn fingerprint_changes_when_target_version_or_membership_changes() {
    let mut existing = vec![target("Clients", "CL-1", json!({"client_id":"CL-1"}))];
    let first = fingerprint(&existing);
    existing[0].version = 2;
    assert_ne!(first, fingerprint(&existing));
    existing.clear();
    assert_ne!(first, fingerprint(&existing));
}
