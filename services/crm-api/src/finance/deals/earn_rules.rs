//! Earn rules shared by the earn and its preview (finance-design §3.6, §5.4, §13 M-F1,
//! M-F2, M-F4, H-F1).
use super::{links, row::DealRow, row::LOST};
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use sqlx::{Postgres, Transaction};

pub const FUTURE: &str = "The earned date cannot be in the future.";
pub const OWN: &str = "Another approver must review your own submissions.";
pub const RANGE: &str =
    "Only your Admin can set an earned date more than 31 days ago or before the deal was created.";
pub const ALREADY: &str = "This deal is already earned.";
pub const LOST_DEAL: &str = "Lost or cancelled deals cannot be earned.";
pub const SECOND_GONE: &str =
    "The second agent can no longer receive commission. Update the split first.";
pub const HOLDER_DIFFERS: &str = "Deal holder is not the client's holder.";

pub fn ensure_not_future(earned_on: &str, today: &str) -> ApiResult<()> {
    (earned_on <= today)
        .then_some(())
        .ok_or(ApiError::invalid(FUTURE))
}

/// Step 7: already earned (409), separation of duties and the earned-date window for
/// staff approvers (403), then Lost or Cancelled (409).
pub async fn ensure_earnable(
    tx: &mut Transaction<'_, Postgres>,
    live: &UserRow,
    deal: &DealRow,
    earned_on: &str,
    today: &str,
) -> ApiResult<()> {
    if deal.earned() {
        return Err(ApiError::conflict(ALREADY));
    }
    if !live.finance_access().manage {
        let involved = deal.assignee_id == Some(live.id) || deal.second_agent_id == Some(live.id);
        if involved || deal.reassigned_by_actor {
            return Err(ApiError::denied(OWN));
        }
        let floor: String = sqlx::query_scalar("SELECT ($1::date - 31)::text")
            .bind(today)
            .fetch_one(&mut **tx)
            .await?;
        if earned_on < deal.created_on.as_str() || earned_on < floor.as_str() {
            return Err(ApiError::denied(RANGE));
        }
    }
    if LOST.contains(&deal.stage.as_str()) {
        return Err(ApiError::conflict(LOST_DEAL));
    }
    Ok(())
}

/// Step 9 (§5.4, L-F1): a second agent must still be active staff with finance.
pub async fn ensure_second_agent(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    deal: &DealRow,
) -> ApiResult<()> {
    match deal.second_agent_id {
        Some(agent) if !links::finance_member(tx, workspace, agent, true).await? => {
            Err(ApiError::conflict(SECOND_GONE))
        }
        _ => Ok(()),
    }
}

/// §13 M-F1: flags a deal whose holder no longer holds its client.
pub async fn warnings(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    deal: &DealRow,
) -> ApiResult<Vec<&'static str>> {
    let differs: bool = sqlx::query_scalar(
        "SELECT NOT EXISTS(SELECT 1 FROM crm_records WHERE workspace_id=$1 \
         AND collection='Clients' AND legacy_id=$2 AND assignee_id IS NOT DISTINCT FROM $3)",
    )
    .bind(workspace)
    .bind(&deal.client_ref)
    .bind(deal.assignee_id)
    .fetch_one(&mut **tx)
    .await?;
    Ok(if differs {
        vec![HOLDER_DIFFERS]
    } else {
        vec![]
    })
}
