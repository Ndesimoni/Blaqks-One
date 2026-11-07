use super::{
    ledger::{self, Outcome},
    specs::{self, Step, Who},
};
use crate::{
    finance::{
        calc::{calculate, Fee, SecondSource, Terms},
        deals, expenses, payments,
    },
    sample::{data, dates::Calendar, staff::SPECS},
};
use std::collections::HashMap;

const TODAY: Calendar = Calendar { today: 20_740 };

/// The net of each sample deal, as the earn computes it (partner share off the fee).
fn nets() -> HashMap<&'static str, i64> {
    let mut nets = HashMap::new();
    for spec in specs::deals(&TODAY) {
        let deal = deals::input::parse(&spec.deal, true).unwrap();
        let terms = Terms {
            fee: Fee::Percentage {
                agreed_value_fils: deal.agreed_value_fils,
                rate_bp: deal.fee_rate_bp.unwrap(),
            },
            partner_share_bp: deal.partner_share_bp,
            agent_share_bp: None,
            second_share_bp: None,
            second_source: SecondSource::FirstAgent,
            vat_registered: true,
        };
        nets.insert(spec.id, calculate(&terms).unwrap().net_fils);
    }
    nets
}

#[test]
fn sample_deals_pass_the_deal_parser_and_link_sample_records() {
    let records = data::records(&TODAY);
    let deals = specs::deals(&TODAY);
    assert_eq!(deals.len(), 6);
    for spec in &deals {
        assert!(spec.id.starts_with("DL-S"), "{}", spec.id);
        let deal = deals::input::parse(&spec.deal, true).unwrap();
        assert!(deal.details["notes"]
            .as_str()
            .unwrap()
            .starts_with("Sample: "));
        let has = |collection, key: &str, id: &str| {
            records.rows(collection).iter().any(|row| row[key] == id)
        };
        assert!(has("Clients", "client_id", &deal.client_ref), "{}", spec.id);
        assert!(has(
            "Properties",
            "property_id",
            deal.property_ref.as_deref().unwrap()
        ));
        // A staff deal starts with the member who holds its client.
        let holds = |index: usize| SPECS[index].holds.contains(&deal.client_ref.as_str());
        match spec.holder {
            Who::Layla => assert!(holds(0), "{}", spec.id),
            Who::Karim => assert!(holds(1), "{}", spec.id),
            Who::Admin => assert!(!(0..3).any(holds), "{}", spec.id),
        }
    }
    let steps: Vec<&Step> = deals.iter().flat_map(|spec| spec.steps).collect();
    assert_eq!(
        steps
            .iter()
            .filter(|step| matches!(step, Step::Earn(_)))
            .count(),
        3
    );
    assert!(steps
        .iter()
        .all(|step| !matches!(step, Step::Earn(day) if *day > 0)));
    let referral = specs::settings().max_referral_share_bp;
    assert!(steps.iter().any(|step| matches!(step, Step::Offer { approved: true, referral: Some(share), .. } if *share <= referral)));
    assert!(steps.iter().any(|step| matches!(
        step,
        Step::Offer {
            approved: false,
            ..
        }
    )));
    assert!(specs::AGREEMENTS[0].1 != specs::AGREEMENTS[1].1);
}

#[test]
fn sample_entries_cover_every_state_and_stay_within_each_deal_net() {
    let nets = nets();
    let mut approved: HashMap<&str, i64> = HashMap::new();
    let earned = ["DL-S02", "DL-S03", "DL-S06"];
    let payments = ledger::payments(&TODAY);
    for spec in &payments {
        let payment = payments::input::parse(&spec.wire, true).unwrap();
        assert!(earned.contains(&spec.deal) && payment.deal_ref.as_deref() == Some(spec.deal));
        assert!(payment.receipt_date <= TODAY.day(0) && spec.id.starts_with("PM-S"));
        if matches!(spec.outcome, Outcome::Approved | Outcome::Voided(_)) {
            *approved.entry(spec.deal).or_default() += payment.amount_fils;
        }
    }
    for (deal, total) in approved {
        assert!(total <= nets[deal], "{deal}: {total} > {}", nets[deal]);
    }
    let expenses = ledger::expenses(&TODAY);
    for spec in &expenses {
        let expense = expenses::input::parse(&spec.wire, true, true).unwrap();
        assert!(expense.date_paid <= TODAY.day(0) && spec.id.starts_with("EX-S"));
        assert!(expense.supplier.unwrap().starts_with("Sample · "));
    }
    let outcomes: Vec<Outcome> = payments
        .iter()
        .chain(&expenses)
        .map(|spec| spec.outcome)
        .collect();
    for wanted in ["Pending", "Approved", "Rejected", "Voided"] {
        assert!(outcomes
            .iter()
            .any(|outcome| format!("{outcome:?}").starts_with(wanted)));
    }
    for outcome in outcomes {
        if let Outcome::Rejected(reason) | Outcome::Voided(reason) = outcome {
            assert!(reason.starts_with("Sample: ") && reason.len() <= 500);
        }
    }
}
