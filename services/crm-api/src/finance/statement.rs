//! The commission statement (finance-design §6.2, §13 M-F5): one agent's lines on current
//! snapshots of this workspace. Second-agent lines carry only `{dealId, earnedOn,
//! dealType, role, amountFils, receivedShareFils, outstandingFils}`, never a share or a
//! handle to fetch the deal; received shares use approved receipts only.
use crate::{error::ApiResult, finance::receipts};
use serde_json::{json, Value};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

#[derive(FromRow)]
struct StatementRow {
    deal_ref: String,
    earned_on: String,
    deal_type: String,
    role: String,
    share_bp: i32,
    amount_fils: i64,
    net_fils: i64,
    split_source: String,
    approved_fils: i64,
}

/// Received share and outstanding of one line (i128 inside `received_share`).
pub fn line_figures(amount: i64, approved: i64, net: i64) -> (i64, i64) {
    let received = receipts::received_share(amount, approved, net);
    (received, amount.saturating_sub(received).max(0))
}

pub async fn statement(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    agent: Uuid,
) -> ApiResult<Value> {
    let rows = sqlx::query_as::<_, StatementRow>(
        "SELECT d.legacy_id AS deal_ref,s.earned_on::text AS earned_on,d.deal_type,l.role, \
         l.share_bp,l.amount_fils,s.net_fils,s.split_source, \
         crm_deal_approved_fils(d.id) AS approved_fils \
         FROM crm_deal_commission_lines l JOIN crm_deal_snapshots s ON s.id=l.snapshot_id \
         JOIN crm_deals d ON d.id=s.deal_id AND d.workspace_id=s.workspace_id \
         WHERE s.workspace_id=$1 AND s.superseded_at IS NULL AND l.agent_id=$2 \
         ORDER BY s.earned_on,d.legacy_id,l.role",
    )
    .bind(workspace)
    .bind(agent)
    .fetch_all(&mut **tx)
    .await?;
    let (mut earned, mut received_total, mut outstanding_total) = (0i128, 0i128, 0i128);
    let lines: Vec<Value> = rows
        .iter()
        .map(|row| {
            let (received, outstanding) =
                line_figures(row.amount_fils, row.approved_fils, row.net_fils);
            earned += i128::from(row.amount_fils);
            received_total += i128::from(received);
            outstanding_total += i128::from(outstanding);
            let mut line = json!({"dealId": row.deal_ref, "earnedOn": row.earned_on,
                "dealType": row.deal_type, "role": row.role, "amountFils": row.amount_fils,
                "receivedShareFils": received, "outstandingFils": outstanding});
            if row.role == "primary" {
                line["shareBp"] = json!(row.share_bp);
                line["adjusted"] = json!(row.split_source == "override");
            }
            line
        })
        .collect();
    let clamp = |total: i128| i64::try_from(total).unwrap_or(i64::MAX);
    Ok(
        json!({"lines": lines, "totals": {"earnedFils": clamp(earned),
        "receivedShareFils": clamp(received_total),
        "outstandingFils": clamp(outstanding_total)}}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn line_figures_follow_the_golden_payments() {
        // G5: primary 2,940,000 of net 4,900,000 with 2,450,000 approved.
        assert_eq!(
            line_figures(2_940_000, 2_450_000, 4_900_000),
            (1_470_000, 1_470_000)
        );
        // G6: second 27,291 of net 218,333 with 100,000 approved.
        assert_eq!(line_figures(27_291, 100_000, 218_333), (12_499, 14_792));
        assert_eq!(line_figures(500, 0, 0), (0, 500));
        assert_eq!(line_figures(500, 900, 500), (500, 0));
    }
}
