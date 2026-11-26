//! Fictional payments and expenses in every approval state, in the API's wire shapes.
//! Payments stay within their deal's net; dates are on or before today (Dubai).
use super::{
    super::{data::NOTE, dates::Calendar},
    specs::Who,
};
use serde_json::{json, Value};

/// Where a sample entry ends up; rejected and voided entries carry the decision reason.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Pending,
    Approved,
    Rejected(&'static str),
    /// Approved, then voided by the Admin.
    Voided(&'static str),
}

pub struct EntrySpec {
    pub id: &'static str,
    /// Payments: the sample deal. Expenses: unused.
    pub deal: &'static str,
    /// Expenses: who incurred it. Payments: the Admin records every receipt.
    pub owner: Who,
    pub outcome: Outcome,
    /// The `payment` or `expense` body (`incurredBy` is added once resolved).
    pub wire: Value,
}

fn entry(
    id: &'static str,
    deal: &'static str,
    owner: Who,
    outcome: Outcome,
    wire: Value,
) -> EntrySpec {
    EntrySpec {
        id,
        deal,
        owner,
        outcome,
        wire,
    }
}

pub fn payments(calendar: &Calendar) -> Vec<EntrySpec> {
    let payment = |deal: &str, day: i64, amount: i64, reference: &str| {
        json!({"dealId": deal, "receiptDate": calendar.day(day), "amountFils": amount,
            "reference": format!("Sample · {reference}"), "notes": NOTE})
    };
    let (admin, approved) = (Who::Admin, Outcome::Approved);
    let returned = Outcome::Voided("Sample: the cheque was returned by the bank.");
    let mismatch = Outcome::Rejected("Sample: the reference does not match the bank statement.");
    vec![
        entry(
            "PM-S01",
            "DL-S02",
            admin,
            approved,
            payment("DL-S02", -14, 450_000, "Cheque 1 of 2"),
        ),
        entry(
            "PM-S02",
            "DL-S02",
            admin,
            returned,
            payment("DL-S02", -12, 450_000, "Cheque 2 of 2"),
        ),
        entry(
            "PM-S03",
            "DL-S03",
            admin,
            Outcome::Pending,
            payment("DL-S03", -3, 240_000, "Transfer"),
        ),
        entry(
            "PM-S04",
            "DL-S03",
            admin,
            mismatch,
            payment("DL-S03", -5, 240_000, "Transfer draft"),
        ),
        entry(
            "PM-S05",
            "DL-S06",
            admin,
            approved,
            payment("DL-S06", -30, 3_562_500, "First half"),
        ),
    ]
}

pub fn expenses(calendar: &Calendar) -> Vec<EntrySpec> {
    let expense = |day: i64, amount: i64, category: &str, supplier: &str, property: &str| {
        json!({"datePaid": calendar.day(day), "amountFils": amount, "category": category,
            "supplier": format!("Sample · {supplier}"), "propertyId": property, "notes": NOTE})
    };
    let mut flyers = expense(-6, 75_000, "Printing", "Marina Print Shop", "PR-S01");
    flyers["campaignReference"] = json!("Sample · Marina open house");
    let duplicate = Outcome::Rejected("Sample: a duplicate of an earlier claim.");
    vec![
        entry(
            "EX-S01",
            "",
            Who::Layla,
            Outcome::Pending,
            expense(-4, 125_000, "Advertising", "Listing portal boost", "PR-S03"),
        ),
        entry(
            "EX-S02",
            "",
            Who::Karim,
            Outcome::Approved,
            expense(
                -15,
                200_000,
                "Photography",
                "Lens and Light Studio",
                "PR-S08",
            ),
        ),
        entry("EX-S03", "", Who::Admin, duplicate, flyers),
    ]
}
