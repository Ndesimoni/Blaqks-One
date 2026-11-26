//! Decision rules (finance-design §4, §13 M-F4, M-F6). Step 7: the state, then separation
//! of duties. Step 9 for payments: under the workspace lock the deal must be earned and
//! the approved total plus this payment must stay within the current snapshot's net.
use super::{
    entry::{EntryState, NOT_APPROVED, VOIDED},
    errors::{DECIDED, OVER, OWN},
    receipts,
};
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const NOT_EARNED: &str = "Payments can be recorded once the deal is earned.";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Verdict {
    Approve,
    Reject,
    Void,
}

/// Step 7. Returns whether an Admin decided a row they have a stake in (`selfDecided`).
pub fn check(verdict: Verdict, state: &EntryState, live: &UserRow) -> ApiResult<bool> {
    match (verdict, state.status.as_str()) {
        (Verdict::Void, "approved") => return Ok(false),
        (Verdict::Void, "void") => return Err(ApiError::conflict(VOIDED)),
        (Verdict::Void, _) => return Err(ApiError::conflict(NOT_APPROVED)),
        (_, "pending") => {}
        _ => return Err(ApiError::conflict(DECIDED)),
    }
    let involved = state.actor_party || state.actor_edited;
    match (live.finance_access().manage, involved) {
        (true, _) => Ok(involved),
        (false, true) => Err(ApiError::denied(OWN)),
        (false, false) => Ok(false),
    }
}

/// A payment's deal under the lock: the current snapshot's net and VAT registration,
/// and the approved total of its other payments.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Funds {
    pub net_fils: Option<i64>,
    pub vat_registered: Option<bool>,
    pub others_fils: i64,
}

impl Funds {
    /// M-F4: earned, and approved + this ≤ net (partial payments allowed).
    pub fn ensure_room(&self, amount_fils: i64) -> ApiResult<()> {
        let net = self.net_fils.ok_or(ApiError::conflict(NOT_EARNED))?;
        let total = i128::from(self.others_fils) + i128::from(amount_fils);
        (total <= i128::from(net))
            .then_some(())
            .ok_or(ApiError::conflict(OVER))
    }

    /// §3.2 step 6 on the current snapshot's VAT registration (or `fallback`).
    pub fn vat(&self, amount_fils: i64, fallback: bool) -> ApiResult<i64> {
        receipts::payment_vat(amount_fils, self.vat_registered.unwrap_or(fallback))
            .map_err(|_| ApiError::invalid(super::entry_wire::MONEY))
    }
}

/// Locks the deal row (`FOR UPDATE`) and reads its funds; `payment` is excluded from the
/// approved total.
pub async fn funds(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    deal_ref: &str,
    payment: Option<Uuid>,
) -> ApiResult<Funds> {
    let row: Option<(Option<i64>, Option<bool>, i64)> = sqlx::query_as(
        "SELECT s.net_fils,s.vat_registered,COALESCE((SELECT sum(p.amount_fils) \
         FROM crm_payments p WHERE p.workspace_id=$1 AND p.deal_ref=$2 AND p.status='approved' \
         AND p.id IS DISTINCT FROM $3),0)::bigint FROM crm_deals d LEFT JOIN crm_deal_snapshots s \
         ON s.deal_id=d.id AND s.superseded_at IS NULL WHERE d.workspace_id=$1 AND d.legacy_id=$2 \
         FOR UPDATE OF d",
    )
    .bind(workspace)
    .bind(deal_ref)
    .bind(payment)
    .fetch_optional(&mut **tx)
    .await?;
    let (net_fils, vat_registered, others_fils) = row.unwrap_or((None, None, 0));
    Ok(Funds {
        net_fils,
        vat_registered,
        others_fils,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn approvals_stay_within_the_net_of_an_earned_deal() {
        let funds = |net, others| Funds {
            net_fils: net,
            vat_registered: Some(true),
            others_fils: others,
        };
        // G5: half of G1's net, then the other half, then one fil more.
        assert!(funds(Some(4_900_000), 0).ensure_room(2_450_000).is_ok());
        assert!(funds(Some(4_900_000), 2_450_000)
            .ensure_room(2_450_000)
            .is_ok());
        let over = funds(Some(4_900_000), 2_450_000).ensure_room(2_450_001);
        assert_eq!(over.unwrap_err().1, OVER);
        let unearned = funds(None, 0).ensure_room(1);
        assert_eq!(unearned.unwrap_err().1, NOT_EARNED);
        assert_eq!(
            funds(Some(1), i64::MAX)
                .ensure_room(i64::MAX)
                .unwrap_err()
                .1,
            OVER
        );
        // G5 VAT: 2,450,000 ex VAT → 122,500; unregistered → 0.
        assert_eq!(funds(Some(1), 0).vat(2_450_000, false).unwrap(), 122_500);
        let off = Funds {
            vat_registered: Some(false),
            ..funds(None, 0)
        };
        assert_eq!(off.vat(2_450_000, true).unwrap(), 0);
        assert_eq!(funds(None, 0).vat(100, false).unwrap(), 5);
    }
}
