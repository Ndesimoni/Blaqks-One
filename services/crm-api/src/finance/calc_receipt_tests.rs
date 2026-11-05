//! Golden payments (G5, G6, G9) and agreement selection (§3.6) from the shared fixture.
use super::tests::{fixture, named, terms};
use super::*;
use serde_json::{json, Value};

#[test]
fn golden_payments_vat_and_received_shares() {
    let golden = fixture();
    let inputs = golden["inputs"].as_array().unwrap();
    for row in golden["payments"].as_array().unwrap() {
        let want = named(&golden["paymentColumns"], row);
        let deal = inputs
            .iter()
            .find(|input| input[0] == want["deal"])
            .unwrap();
        let (terms, _) = terms(&named(&golden["inputColumns"], deal), 5000);
        let deal = calculate(&terms).unwrap();
        let payments: Vec<i64> = want["paymentsFils"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_i64().unwrap())
            .collect();
        let vat: Vec<i64> = payments
            .iter()
            .map(|a| payment_vat(*a, terms.vat_registered).unwrap())
            .collect();
        let total: Vec<i64> = payments.iter().zip(&vat).map(|(a, v)| a + v).collect();
        let received: i64 = payments.iter().sum();
        let share =
            |line: Option<i64>| line.map(|line| received_share(line, received, deal.net_fils));
        let actual = json!({"id": want["id"], "deal": want["deal"], "paymentsFils": payments,
            "vatFils": vat, "totalFils": total, "receivedFils": received,
            "primaryReceivedFils": share(deal.primary_fils),
            "secondReceivedFils": share(deal.second_fils),
            "outstandingFils": outstanding(deal.net_fils, received)});
        assert_eq!(actual, Value::Object(want));
    }
}

#[test]
fn agreements_apply_from_inclusive_to_exclusive() {
    let golden = fixture();
    let agreements: Vec<_> = golden["agreements"]
        .as_array()
        .unwrap()
        .iter()
        .map(|row| named(&golden["agreementColumns"], row))
        .collect();
    for case in golden["agreementCases"].as_array().unwrap() {
        let on = case[0].as_str().unwrap();
        let found = agreements.iter().find(|a| {
            in_force(
                a["effectiveFrom"].as_str().unwrap(),
                a["effectiveTo"].as_str(),
                on,
            )
        });
        assert_eq!(
            found.map(|a| a["id"].clone()).unwrap_or(Value::Null),
            case[1],
            "{on}"
        );
    }
}
