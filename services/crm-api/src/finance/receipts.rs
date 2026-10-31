//! Payment VAT and received shares (finance-design §3.2 steps 6–7).
use super::calc::{fils, hu, out, OutOfRange, VAT_RATE_BP};

/// §3.2 step 6: VAT on one payment (ex VAT), half-up; per-payment rounding may differ
/// from the deal VAT by at most 1 fil per payment.
pub fn payment_vat(amount_fils: i64, vat_registered: bool) -> Result<i64, OutOfRange> {
    let amount = fils(amount_fils)?;
    out(if vat_registered {
        hu(amount, VAT_RATE_BP)
    } else {
        0
    })
}

/// §3.2 step 7: a commission line's share of approved receipts, `line·min(r,net) div net`.
pub fn received_share(line_fils: i64, received_fils: i64, net_fils: i64) -> i64 {
    let (line, net) = (i128::from(line_fils.max(0)), i128::from(net_fils.max(0)));
    if net == 0 {
        return 0;
    }
    let received = i128::from(received_fils.clamp(0, net_fils.max(0)));
    i64::try_from(line * received / net).unwrap_or(0)
}

/// Deal outstanding: `max(0, net − received)`.
pub fn outstanding(net_fils: i64, received_fils: i64) -> i64 {
    net_fils.saturating_sub(received_fils).max(0)
}
