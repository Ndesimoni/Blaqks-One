//! A deal's figures for display: the current snapshot when earned, otherwise a preview
//! computed from today's settings and agreements (`preview: true`, §6.2).
use super::{
    compute::Outcome,
    names,
    row::DealRow,
    snapshot::{LineRow, SnapshotRow},
};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Line {
    pub role: String,
    pub agent_id: Uuid,
    pub agent_name: String,
    pub share_bp: i32,
    pub amount_fils: i64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Figures {
    pub preview: bool,
    pub revision: Option<i32>,
    pub source: String,
    pub agreement_id: Option<Uuid>,
    pub primary_agent: Option<Uuid>,
    pub gross_fils: i64,
    pub partner_fils: i64,
    pub net_fils: i64,
    pub company_fils: i64,
    pub vat_fils: i64,
    pub lines: Vec<Line>,
}

impl Figures {
    pub fn from_snapshot(snapshot: &SnapshotRow, lines: &[LineRow]) -> Self {
        let lines = lines
            .iter()
            .filter(|line| line.snapshot_id == snapshot.id)
            .map(|line| Line {
                role: line.role.clone(),
                agent_id: line.agent_id,
                agent_name: line.agent_name.clone(),
                share_bp: line.share_bp,
                amount_fils: line.amount_fils,
            })
            .collect();
        Self {
            preview: false,
            revision: Some(snapshot.revision),
            source: snapshot.split_source.clone(),
            agreement_id: snapshot.agreement_id,
            primary_agent: snapshot.primary_agent_id,
            gross_fils: snapshot.gross_fils,
            partner_fils: snapshot.partner_fils,
            net_fils: snapshot.net_fils,
            company_fils: snapshot.company_fils,
            vat_fils: snapshot.vat_fils,
            lines,
        }
    }

    /// A preview of an unearned deal: the holder is the primary agent.
    pub fn preview(deal: &DealRow, outcome: &Outcome) -> Self {
        let calc = &outcome.calculation;
        let mut lines = Vec::new();
        let primary = outcome.basis.primary.zip(outcome.share_bp);
        if let (Some((agent, share)), Some(amount)) = (primary, calc.primary_fils) {
            let name = deal.assignee_name.clone().unwrap_or_default();
            lines.push(line("primary", agent, name, share, amount));
        }
        if let (Some((agent, share)), Some(amount)) = (outcome.second, calc.second_fils) {
            let name = deal.second_agent_name.clone().unwrap_or_default();
            lines.push(line("second", agent, name, share, amount));
        }
        Self {
            preview: true,
            revision: None,
            source: names::source_name(outcome.source).into(),
            agreement_id: outcome.basis.agreement.map(|(id, _)| id),
            primary_agent: outcome.basis.primary,
            gross_fils: calc.gross_fils,
            partner_fils: calc.partner_fils,
            net_fils: calc.net_fils,
            company_fils: calc.company_fils,
            vat_fils: calc.vat_fils,
            lines,
        }
    }
}

fn line(role: &str, agent_id: Uuid, agent_name: String, share_bp: i32, amount: i64) -> Line {
    Line {
        role: role.into(),
        agent_id,
        agent_name,
        share_bp,
        amount_fils: amount,
    }
}
