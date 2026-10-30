//! Golden cases G1–G10 and edge cases from `apps/crm/tests/fixtures/finance-golden.json`, shared
//! with the JS preview so both implementations agree exactly.
use super::*;
use serde_json::{json, Value};

pub const GOLDEN: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/crm/tests/fixtures/finance-golden.json"
));

pub fn fixture() -> Value {
    serde_json::from_str(GOLDEN).expect("the golden fixture is valid JSON")
}

/// Maps one row to `{column: value}` using a space-separated column list.
pub fn named(columns: &Value, row: &Value) -> serde_json::Map<String, Value> {
    let names = columns.as_str().unwrap().split(' ');
    names
        .zip(row.as_array().unwrap().iter().cloned())
        .map(|(k, v)| (k.into(), v))
        .collect()
}

fn int<T: TryFrom<i64>>(value: &Value) -> Option<T> {
    value
        .as_i64()
        .map(|v| T::try_from(v).ok().expect("in range"))
}

/// Builds the terms and split source for one input row.
pub fn terms(input: &serde_json::Map<String, Value>, team_default: i32) -> (Terms, SplitSource) {
    let fee = match input["feeBasis"].as_str().unwrap() {
        "fixed" => Fee::Fixed {
            fee_fils: int(&input["fixedFeeFils"]).unwrap(),
        },
        _ => Fee::Percentage {
            agreed_value_fils: int(&input["agreedValueFils"]).unwrap(),
            rate_bp: int(&input["feeRateBp"]).unwrap(),
        },
    };
    let (agent_share_bp, source) = select_share(
        input["ownerHeld"].as_bool().unwrap(),
        int(&input["overrideBp"]),
        int(&input["agreementBp"]),
        team_default,
    );
    let second_source = match input["secondAgentSource"].as_str().unwrap() {
        "company" => SecondSource::Company,
        _ => SecondSource::FirstAgent,
    };
    let terms = Terms {
        fee,
        partner_share_bp: int(&input["partnerShareBp"]).unwrap(),
        agent_share_bp,
        second_share_bp: int(&input["secondAgentShareBp"]),
        second_source,
        vat_registered: input["vatRegistered"].as_bool().unwrap(),
    };
    (terms, source)
}

pub fn source_name(source: SplitSource) -> &'static str {
    match source {
        SplitSource::Override => "override",
        SplitSource::Agreement => "agreement",
        SplitSource::TeamDefault => "team_default",
        SplitSource::Owner => "owner",
    }
}

#[test]
fn golden_calculations_match_the_shared_fixture() {
    let golden = fixture();
    let team_default = int(&golden["teamDefaultBp"]).unwrap();
    let inputs = golden["inputs"].as_array().unwrap();
    let outputs = golden["outputs"].as_array().unwrap();
    assert_eq!(inputs.len(), 15);
    for (input, output) in inputs.iter().zip(outputs) {
        let input = named(&golden["inputColumns"], input);
        let want = named(&golden["outputColumns"], output);
        assert_eq!(input["id"], want["id"]);
        let (terms, source) = terms(&input, team_default);
        let got = calculate(&terms).unwrap();
        let actual = json!({"id": input["id"], "splitSource": source_name(source),
            "agentShareBp": terms.agent_share_bp, "grossFils": got.gross_fils,
            "partnerFils": got.partner_fils, "netFils": got.net_fils,
            "primaryFils": got.primary_fils, "secondFils": got.second_fils,
            "companyFils": got.company_fils, "vatFils": got.vat_fils});
        assert_eq!(actual, Value::Object(want), "{}", input["id"]);
    }
}

#[test]
fn out_of_range_inputs_are_refused_without_overflow() {
    let base = Terms {
        fee: Fee::Fixed { fee_fils: MAX_FILS },
        partner_share_bp: 0,
        agent_share_bp: Some(MAX_BP),
        second_share_bp: Some(MAX_BP),
        second_source: SecondSource::Company,
        vat_registered: true,
    };
    assert!(calculate(&base).is_ok());
    let fee = |fee_fils| Terms {
        fee: Fee::Fixed { fee_fils },
        ..base
    };
    assert_eq!(calculate(&fee(MAX_FILS + 1)), Err(OutOfRange));
    assert_eq!(calculate(&fee(-1)), Err(OutOfRange));
    assert_eq!(
        calculate(&Terms {
            partner_share_bp: 10_001,
            ..base
        }),
        Err(OutOfRange)
    );
    assert_eq!(
        calculate(&Terms {
            second_share_bp: Some(-1),
            ..base
        }),
        Err(OutOfRange)
    );
    assert_eq!(payment_vat(i64::MAX, true), Err(OutOfRange));
    assert_eq!(received_share(10, 5, 0), 0);
    assert_eq!(received_share(10, i64::MAX, 10), 10);
    assert_eq!(outstanding(10, 25), 0);
}
