//! A deal's split from its terms (finance-design §3.2, §3.6): the holder's share comes
//! from an override, the agreement in force on the date, or the team default.
use super::{input::MONEY, names::second_source, row::DealRow};
use crate::{
    error::{ApiError, ApiResult},
    finance::{
        calc::{calculate, select_share, Calculation, Fee, SecondSource, SplitSource, Terms},
        settings_store,
    },
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const NO_SETTINGS: &str = "Set up your team's commission split before marking deals earned.";

/// The share inputs a split is computed from.
#[derive(Clone, Debug, PartialEq)]
pub struct Basis {
    /// The primary agent; `None` for owner-held or queued deals (no agent lines, Q4).
    pub primary: Option<Uuid>,
    /// The agreement used and its share.
    pub agreement: Option<(Uuid, i32)>,
    pub team_default_bp: i32,
    pub team_second_source: SecondSource,
    pub vat_registered: bool,
}

#[derive(Clone, Debug)]
pub struct Outcome {
    pub basis: Basis,
    pub source: SplitSource,
    pub share_bp: Option<i32>,
    /// The second agent and share when a second line is computed.
    pub second: Option<(Uuid, i32)>,
    pub calculation: Calculation,
}

/// §3.2 with the deal's current terms. A referral is always taken from the primary
/// agent's share (§13 H-F1); an Admin-set split follows the team setting.
pub fn compute(deal: &DealRow, basis: Basis) -> ApiResult<Outcome> {
    let fee = match deal.fee_basis.as_str() {
        "fixed" => Fee::Fixed {
            fee_fils: deal.fixed_fee_fils.unwrap_or(0),
        },
        _ => Fee::Percentage {
            agreed_value_fils: deal.agreed_value_fils,
            rate_bp: deal.fee_rate_bp.unwrap_or(0),
        },
    };
    let (share_bp, source) = select_share(
        basis.primary.is_none(),
        deal.override_agent_share_bp,
        basis.agreement.map(|(_, share)| share),
        basis.team_default_bp,
    );
    let second = share_bp.and(deal.second_agent_id.zip(deal.second_agent_share_bp));
    let second_source = match deal.second_agent_kind.as_deref() {
        Some("referral") => SecondSource::FirstAgent,
        _ => basis.team_second_source,
    };
    let terms = Terms {
        fee,
        partner_share_bp: deal.partner_share_bp,
        agent_share_bp: share_bp,
        second_share_bp: second.map(|(_, share)| share),
        second_source,
        vat_registered: basis.vat_registered,
    };
    let calculation = calculate(&terms).map_err(|_| ApiError::invalid(MONEY))?;
    Ok(Outcome {
        source,
        share_bp,
        second,
        calculation,
        basis,
    })
}

/// The agreement of `agent` in force on `on` (from inclusive, to exclusive).
pub async fn agreement_on(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    agent: Uuid,
    on: &str,
) -> ApiResult<Option<(Uuid, i32)>> {
    Ok(sqlx::query_as(
        "SELECT id,agent_share_bp FROM crm_commission_agreements WHERE workspace_id=$1 \
         AND agent_id=$2 AND effective_from <= $3::date \
         AND (effective_to IS NULL OR effective_to > $3::date)",
    )
    .bind(workspace)
    .bind(agent)
    .bind(on)
    .fetch_optional(&mut **transaction)
    .await?)
}

/// The basis for earning (or previewing) `deal` on `on` from today's settings; 409 when
/// the team has no settings yet. `FOR SHARE` keeps them steady until commit.
pub async fn current_basis(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    deal: &DealRow,
    on: &str,
) -> ApiResult<Basis> {
    sqlx::query("SELECT 1 FROM crm_finance_settings WHERE workspace_id=$1 FOR SHARE")
        .bind(workspace)
        .execute(&mut **transaction)
        .await?;
    let settings = settings_store::load(transaction, workspace, false).await?;
    let settings = settings.ok_or(ApiError::conflict(NO_SETTINGS))?;
    let primary = deal.assignee_id.filter(|_| deal.assignee_staff);
    let agreement = match primary {
        Some(agent) => agreement_on(transaction, workspace, agent, on).await?,
        None => None,
    };
    Ok(Basis {
        primary,
        agreement,
        team_default_bp: settings.agent_share_bp,
        team_second_source: second_source(&settings.second_agent_source),
        vat_registered: settings.vat_registered,
    })
}
