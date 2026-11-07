//! DealView shaped per caller (finance-design §5.3, §6.2, §13 M-F5). The own view never
//! carries the company share, other agents' lines or amounts, the split source beyond
//! `adjusted`, the override or its reason, or the second agent's ID and share.
use super::{figures::Figures, row::DealRow, row::LOST};
use crate::{
    auth::{
        finance_access::{FinanceAccess, FinanceScope},
        profile::UserRow,
    },
    finance::receipts,
};
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Clone, Copy, Debug)]
pub struct Viewer {
    pub id: Uuid,
    pub team: bool,
    pub access: FinanceAccess,
}

impl Viewer {
    pub fn of(user: &UserRow) -> Self {
        let access = user.finance_access();
        Self {
            id: user.id,
            team: access.scope == FinanceScope::Team,
            access,
        }
    }
}

fn person(id: Option<Uuid>, name: &Option<String>) -> Value {
    id.map_or(Value::Null, |id| json!({"id": id, "name": name}))
}

/// `calculation`: team view in full; own view without the company share, the source or
/// other agents' lines, and the caller's own line without its share.
pub fn calculation(figures: &Figures, viewer: &Viewer) -> Value {
    let adjusted = figures.source == "override";
    let mut value = json!({"preview": figures.preview, "revision": figures.revision,
        "grossFils": figures.gross_fils, "partnerFils": figures.partner_fils,
        "netFils": figures.net_fils, "vatFils": figures.vat_fils, "adjusted": adjusted});
    if viewer.team {
        let lines: Vec<Value> = figures
            .lines
            .iter()
            .map(|line| {
                json!({"role": line.role,
            "agent": {"id": line.agent_id, "name": line.agent_name},
            "shareBp": line.share_bp, "amountFils": line.amount_fils})
            })
            .collect();
        value["lines"] = Value::Array(lines);
        value["companyFils"] = json!(figures.company_fils);
        value["splitSource"] = json!(figures.source);
        value["agreementId"] = json!(figures.agreement_id);
    } else {
        let lines: Vec<Value> = figures
            .lines
            .iter()
            .filter(|line| line.agent_id == viewer.id)
            .map(|line| json!({"role": line.role, "amountFils": line.amount_fils}))
            .collect();
        value["lines"] = Value::Array(lines);
    }
    value
}

/// Per-row actions the server would allow this caller (§6.2); never re-derived in JS.
pub fn allowed(deal: &DealRow, viewer: &Viewer) -> Value {
    let access = viewer.access;
    let earned = deal.earned();
    let own = deal.assignee_id == Some(viewer.id);
    let separate = !own && deal.second_agent_id != Some(viewer.id) && !deal.reassigned_by_actor;
    let earnable = !earned && !LOST.contains(&deal.stage.as_str());
    // An open hand-over holds earning, unearning and revising (agreements design §17).
    let settled = deal.pending_handover.is_none();
    json!({"edit": access.edit, "assign": access.manage,
        "handOver": access.assign && own && settled,
        "earn": access.approve && earnable && (access.manage || separate) && settled,
        "split": access.manage && !earned, "revise": access.manage && earned && settled,
        "unearn": access.manage && earned && settled,
        "delete": access.manage && !deal.ever_earned})
}

pub fn deal(deal: &DealRow, figures: Option<&Figures>, viewer: &Viewer) -> Value {
    let net = figures.filter(|f| !f.preview).map_or(0, |f| f.net_fils);
    let outstanding = receipts::outstanding(net, deal.approved_fils);
    let status = match (deal.earned(), outstanding) {
        (false, _) => "not_earned",
        (true, 0) => "paid",
        (true, _) => "outstanding",
    };
    let second = match (deal.second_agent_id, viewer.team) {
        (None, _) => Value::Null,
        (Some(id), true) => json!({"id": id, "name": deal.second_agent_name,
            "shareBp": deal.second_agent_share_bp, "kind": deal.second_agent_kind}),
        (Some(_), false) => json!({"name": deal.second_agent_name}),
    };
    let mut value = json!({"id": deal.id, "version": deal.version, "dealId": deal.legacy_id,
        "assignee": person(deal.assignee_id, &deal.assignee_name),
        "clientId": deal.client_ref, "propertyId": deal.property_ref,
        "dealType": deal.deal_type, "stage": deal.stage,
        "agreedValueFils": deal.agreed_value_fils, "feeBasis": deal.fee_basis,
        "feeRateBp": deal.fee_rate_bp, "fixedFeeFils": deal.fixed_fee_fils,
        "partnerShareBp": deal.partner_share_bp, "partnerName": deal.partner_name,
        "earnedOn": deal.earned_on, "details": deal.details.0, "secondAgent": second,
        "calculation": figures.map(|figures| calculation(figures, viewer)),
        "receivedFils": deal.approved_fils.min(net), "outstandingFils": outstanding,
        "paymentStatus": status, "pendingHandover": deal.pending_handover,
        "allowed": allowed(deal, viewer)});
    if viewer.team {
        value["override"] = deal.override_agent_share_bp.map_or(
            Value::Null,
            |share| json!({"agentShareBp": share, "reason": deal.override_reason}),
        );
    }
    value
}

#[cfg(test)]
#[path = "views_tests.rs"]
mod tests;
