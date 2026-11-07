//! Fictional finance samples in the API's wire shapes, so the real input parsers check
//! them. Money is in fils (AED × 100), rates in basis points, dates relative to today.
use super::super::{data::NOTE, dates::Calendar};
use crate::finance::settings::SettingsInput;
use serde_json::{json, Value};

/// Who a sample belongs to: the workspace Admin or one of the sample staff.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Who {
    Admin,
    Layla,
    Karim,
}

/// Team defaults, used only when the workspace has no finance settings yet.
pub fn settings() -> SettingsInput {
    SettingsInput {
        version: None,
        agent_share_bp: 5_000,
        second_agent_source: "first_agent",
        max_referral_share_bp: 2_500,
        vat_registered: true,
        trn: None,
    }
}

/// `(agent, share, starts this many days from today)`; the two splits differ.
pub const AGREEMENTS: [(Who, i32, i64); 2] = [(Who::Layla, 5_500, -180), (Who::Karim, 6_000, -240)];

/// What happens to a new deal after it is created, in order.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Step {
    /// Earned on this day offset (a snapshot with commission lines).
    Earn(i64),
    /// The holder offers the deal; `approved` means the Admin approves it at once.
    Offer {
        to: Who,
        referral: Option<i32>,
        approved: bool,
    },
    /// The Admin moves the deal to themselves (owner-held: no agent lines).
    HoldByAdmin,
}

pub struct DealSpec {
    pub id: &'static str,
    /// The client's holder, who becomes the deal's first holder.
    pub holder: Who,
    pub steps: &'static [Step],
    pub deal: Value,
}

fn deal(client: &str, property: &str, kind: &str, stage: &str, value: i64, notes: &str) -> Value {
    json!({"clientId": client, "propertyId": property, "dealType": kind, "stage": stage,
        "agreedValueFils": value, "feeBasis": "percentage",
        "feeRateBp": if kind == "Sale" { 200 } else { 500 },
        "details": {"notes": format!("Sample: {notes}. {NOTE}")}})
}

const HANDED_OVER: &[Step] = &[Step::Offer {
    to: Who::Karim,
    referral: Some(2_000),
    approved: true,
}];
const OFFERED: &[Step] = &[Step::Offer {
    to: Who::Karim,
    referral: None,
    approved: false,
}];

pub fn deals(calendar: &Calendar) -> Vec<DealSpec> {
    let mut estimate = deal(
        "CL-S01",
        "PR-S01",
        "Sale",
        "Negotiation",
        240_000_000,
        "estimate",
    );
    estimate["details"]["target_close_date"] = json!(calendar.day(21));
    let mut admin = deal(
        "CL-S07",
        "PR-S12",
        "Sale",
        "Documentation",
        475_000_000,
        "co-broked",
    );
    admin["partnerShareBp"] = json!(2_500);
    admin["partnerName"] = json!("Sample · Gulf Coast Realty");
    let office = deal(
        "CL-S06",
        "PR-S08",
        "Rental",
        "Documentation",
        18_000_000,
        "office",
    );
    let studio = deal(
        "CL-S02",
        "PR-S03",
        "Rental",
        "Documentation",
        4_800_000,
        "studio",
    );
    let handed = deal(
        "CL-S09",
        "PR-S02",
        "Rental",
        "Offer",
        9_500_000,
        "referral kept",
    );
    let offered = deal(
        "CL-S04",
        "PR-S07",
        "Rental",
        "Viewing",
        14_000_000,
        "hand-over offered",
    );
    vec![
        spec("DL-S01", Who::Karim, &[], estimate),
        spec("DL-S02", Who::Karim, &[Step::Earn(-18)], office),
        spec("DL-S03", Who::Layla, &[Step::Earn(-9)], studio),
        spec("DL-S04", Who::Layla, HANDED_OVER, handed),
        spec("DL-S05", Who::Layla, OFFERED, offered),
        spec(
            "DL-S06",
            Who::Admin,
            &[Step::HoldByAdmin, Step::Earn(-40)],
            admin,
        ),
    ]
}

fn spec(id: &'static str, holder: Who, steps: &'static [Step], deal: Value) -> DealSpec {
    DealSpec {
        id,
        holder,
        steps,
        deal,
    }
}
