use kws_crm_api::{
    imports::{model::ImportRecords, planning::plan, snapshot::TargetRow},
    records::{collections::COLLECTIONS, validation::validate},
};
use serde_json::{json, Value};
use uuid::Uuid;

fn source(value: Value) -> ImportRecords {
    let mut records = serde_json::from_value::<ImportRecords>(value).unwrap();
    for collection in COLLECTIONS {
        records.0.entry(collection.name.into()).or_default();
    }
    records.normalize().unwrap()
}

fn client(id: &str) -> TargetRow {
    TargetRow {
        id: Uuid::new_v4(),
        version: 1,
        collection: "Clients".into(),
        legacy_id: id.into(),
        payload: json!({ "client_id": id }),
    }
}

#[test]
fn referral_fields_fill_the_referral_slot_only() {
    let referred = validate(
        "Clients",
        json!({"client_id":"CL-2","referred_by_client_id":" CL-1 "}),
    )
    .unwrap();
    assert_eq!(referred.links.referral.as_deref(), Some("CL-1"));
    assert_eq!(referred.links.client, None);
    assert_eq!(referred.payload["referred_by_client_id"], "CL-1");
    let care = validate(
        "Client care",
        json!({"care_id":"CC-1","client_id":"CL-1","referred_client_id":"CL-2"}),
    )
    .unwrap();
    assert_eq!(care.links.client.as_deref(), Some("CL-1"));
    assert_eq!(care.links.referral.as_deref(), Some("CL-2"));
    let blank = validate(
        "Clients",
        json!({"client_id":"CL-3","referred_by_client_id":"  "}),
    );
    assert_eq!(blank.unwrap().links.referral, None);
    let numeric = json!({"client_id":"CL-4","referred_by_client_id":7});
    assert!(validate("Clients", numeric).is_err());
}

#[test]
fn clients_cannot_refer_themselves() {
    let error = match validate(
        "Clients",
        json!({"client_id":" CL-1 ","referred_by_client_id":"CL-1"}),
    ) {
        Ok(_) => panic!("expected a self-referral rejection"),
        Err(error) => error,
    };
    assert_eq!(error.0.as_u16(), 400);
    assert_eq!(
        error.1,
        "A client cannot be recorded as their own referrer."
    );
    let care = json!({"care_id":"CL-1","client_id":"CL-1","referred_client_id":"CL-1"});
    assert!(validate("Client care", care).is_ok());
}

#[test]
fn imports_accept_referrers_later_in_the_batch_or_in_the_target() {
    let input = source(json!({
        "Clients":[
            {"client_id":"CL-A","referred_by_client_id":"CL-B"},
            {"client_id":"CL-B","referred_by_client_id":"CL-OLD"}
        ],
        "Client care":[{"care_id":"CC-1","client_id":"CL-A","referred_client_id":"CL-B"}]
    }));
    let planned = plan(input, &[client("CL-OLD")]).unwrap();
    assert_eq!(planned.counts["Clients"], 2);
    assert_eq!(planned.counts["Client care"], 1);
    let rows = planned.records.rows("Clients");
    assert_eq!(rows[0]["referred_by_client_id"], "CL-B");
}

#[test]
fn imports_reject_missing_referrers_and_self_referrals() {
    for missing in [
        json!({"Clients":[{"client_id":"CL-A","referred_by_client_id":"CL-NONE"}]}),
        json!({"Client care":[{"care_id":"CC-1","referred_client_id":"CL-NONE"}]}),
    ] {
        let error = match plan(source(missing), &[client("CL-OLD")]) {
            Ok(_) => panic!("expected a missing referrer"),
            Err(error) => error,
        };
        assert_eq!(
            error.1,
            "A record links to a client, contact or property missing from this workspace."
        );
    }
    let mut looping = serde_json::from_value::<ImportRecords>(
        json!({"Clients":[{"client_id":"CL-A","referred_by_client_id":"CL-A"}]}),
    )
    .unwrap();
    for collection in COLLECTIONS {
        looping.0.entry(collection.name.into()).or_default();
    }
    assert!(looping.normalize().is_err());
}
