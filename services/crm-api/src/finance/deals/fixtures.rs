//! Test fixtures: a synthetic earned deal with an override and a second agent.
use super::{
    figures::{Figures, Line},
    row::DealRow,
};
use crate::auth::finance_access::{FinanceAccess, FinanceScope};
use serde_json::json;
use sqlx::types::Json;
use uuid::Uuid;

pub fn access(team: bool, manage: bool) -> FinanceAccess {
    FinanceAccess {
        scope: if team {
            FinanceScope::Team
        } else {
            FinanceScope::Own
        },
        create: true,
        edit: true,
        assign: true,
        approve: team,
        team_view: team,
        manage,
    }
}

pub fn deal(holder: Uuid, second: Uuid) -> DealRow {
    DealRow {
        id: Uuid::new_v4(),
        version: 3,
        legacy_id: "DL-001".into(),
        assignee_id: Some(holder),
        assignee_name: Some("Holder".into()),
        assignee_staff: true,
        client_ref: "CL-001".into(),
        property_ref: None,
        deal_type: "Sale".into(),
        stage: "Completed".into(),
        agreed_value_fils: 245_000_000,
        fee_basis: "percentage".into(),
        fee_rate_bp: Some(200),
        fixed_fee_fils: None,
        partner_share_bp: 0,
        partner_name: None,
        second_agent_id: Some(second),
        second_agent_name: Some("Second".into()),
        second_agent_share_bp: Some(2500),
        second_agent_kind: Some("split".into()),
        override_agent_share_bp: Some(8000),
        override_reason: Some("Synthetic reason".into()),
        earned_on: Some("2026-10-01".into()),
        details: Json(json!({})),
        created_on: "2026-09-01".into(),
        ever_earned: true,
        approved_fils: 0,
        reassigned_by_actor: false,
        pending_handover: None,
    }
}

pub fn figures(holder: Uuid, second: Uuid) -> Figures {
    let line = |role: &str, agent, amount| Line {
        role: role.into(),
        agent_id: agent,
        agent_name: role.into(),
        share_bp: 1,
        amount_fils: amount,
    };
    Figures {
        preview: false,
        revision: Some(1),
        source: "override".into(),
        agreement_id: None,
        primary_agent: Some(holder),
        gross_fils: 4_900_000,
        partner_fils: 0,
        net_fils: 4_900_000,
        company_fils: 980_000,
        vat_fils: 245_000,
        lines: vec![
            line("primary", holder, 2_940_000),
            line("second", second, 980_000),
        ],
    }
}
