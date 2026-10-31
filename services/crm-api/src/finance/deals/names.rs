//! Names stored with snapshots and shown in views, and the stored calculation input.
use super::{compute::Outcome, row::DealRow};
use crate::finance::calc::{SecondSource, SplitSource};
use serde_json::{json, Value};

pub fn source_name(source: SplitSource) -> &'static str {
    match source {
        SplitSource::Override => "override",
        SplitSource::Agreement => "agreement",
        SplitSource::TeamDefault => "team_default",
        SplitSource::Owner => "owner",
    }
}

pub fn second_source_name(source: SecondSource) -> &'static str {
    match source {
        SecondSource::FirstAgent => "first_agent",
        SecondSource::Company => "company",
    }
}

pub fn second_source(name: &str) -> SecondSource {
    match name {
        "company" => SecondSource::Company,
        _ => SecondSource::FirstAgent,
    }
}

/// The full calculation input stored with a snapshot (§2.2), revision-carried by revise.
pub fn inputs(deal: &DealRow, outcome: &Outcome) -> Value {
    let basis = &outcome.basis;
    json!({"feeBasis": deal.fee_basis, "agreedValueFils": deal.agreed_value_fils,
        "feeRateBp": deal.fee_rate_bp, "fixedFeeFils": deal.fixed_fee_fils,
        "partnerShareBp": deal.partner_share_bp, "agentShareBp": outcome.share_bp,
        "splitSource": source_name(outcome.source), "primaryAgentId": basis.primary,
        "agreementId": basis.agreement.map(|(id, _)| id),
        "agreementShareBp": basis.agreement.map(|(_, share)| share),
        "teamDefaultBp": basis.team_default_bp,
        "teamSecondSource": second_source_name(basis.team_second_source),
        "secondAgentId": deal.second_agent_id, "secondAgentShareBp": deal.second_agent_share_bp,
        "secondAgentKind": deal.second_agent_kind,
        "overrideAgentShareBp": deal.override_agent_share_bp,
        "vatRegistered": basis.vat_registered, "vatRateBp": 500})
}
