//! The pure commission calculation (finance-design §3, §13 L-F3). All values are
//! integers: money in fils (1 AED = 100 fils), rates and shares in basis points.
//! Intermediate products use checked `i128`; the server is authoritative and the
//! frontend preview mirrors this file against `apps/crm/tests/fixtures/finance-golden.json`.

/// AED 100bn, the storage cap for any money column.
pub const MAX_FILS: i64 = 10_000_000_000_000;
pub const MAX_BP: i32 = 10_000;
/// UAE VAT, fixed at 5% by decision.
pub const VAT_RATE_BP: i32 = 500;

pub use super::{
    receipts::{outstanding, payment_vat, received_share},
    selection::{in_force, select_share, SplitSource},
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Fee {
    Percentage {
        agreed_value_fils: i64,
        rate_bp: i32,
    },
    /// A rate entered with a fixed basis is ignored.
    Fixed { fee_fils: i64 },
}

/// Whose share a second agent's percentage is taken from (team setting).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SecondSource {
    FirstAgent,
    Company,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Terms {
    pub fee: Fee,
    pub partner_share_bp: i32,
    /// `None` when the owner holds the deal or it is in the queue: no agent lines.
    pub agent_share_bp: Option<i32>,
    pub second_share_bp: Option<i32>,
    pub second_source: SecondSource,
    pub vat_registered: bool,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Calculation {
    pub gross_fils: i64,
    pub partner_fils: i64,
    pub net_fils: i64,
    pub primary_fils: Option<i64>,
    pub second_fils: Option<i64>,
    pub company_fils: i64,
    pub vat_fils: i64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OutOfRange;

/// Half-up: `(a·b + 5000) div 10000`.
pub(super) fn hu(a: i128, bp: i32) -> i128 {
    (a * i128::from(bp) + 5_000) / 10_000
}

/// Floor: `(a·b) div 10000`.
pub(super) fn fl(a: i128, bp: i32) -> i128 {
    a * i128::from(bp) / 10_000
}

pub(super) fn fils(value: i64) -> Result<i128, OutOfRange> {
    (0..=MAX_FILS)
        .contains(&value)
        .then_some(i128::from(value))
        .ok_or(OutOfRange)
}

pub(super) fn bp(value: i32) -> Result<i32, OutOfRange> {
    (0..=MAX_BP)
        .contains(&value)
        .then_some(value)
        .ok_or(OutOfRange)
}

pub(super) fn out(value: i128) -> Result<i64, OutOfRange> {
    i64::try_from(value)
        .ok()
        .filter(|v| *v >= 0)
        .ok_or(OutOfRange)
}

/// §3.2 steps 1–5. Fee and partner round half-up; agent lines floor; the company
/// absorbs every remainder (and the primary agent the pool remainder in first-agent mode).
pub fn calculate(terms: &Terms) -> Result<Calculation, OutOfRange> {
    let gross = match terms.fee {
        Fee::Fixed { fee_fils } => fils(fee_fils)?,
        Fee::Percentage {
            agreed_value_fils,
            rate_bp,
        } => hu(fils(agreed_value_fils)?, bp(rate_bp)?),
    };
    let partner = hu(gross, bp(terms.partner_share_bp)?);
    let net = gross.checked_sub(partner).ok_or(OutOfRange)?;
    let (mut primary, mut second, mut company) = (None, None, net);
    if let Some(share) = terms.agent_share_bp {
        let share = bp(share)?;
        let (p, s, c) = match (
            terms.second_share_bp.map(bp).transpose()?,
            terms.second_source,
        ) {
            (None, _) => (fl(net, share), None, net - fl(net, share)),
            (Some(cut), SecondSource::FirstAgent) => {
                let pool = fl(net, share);
                let second = fl(pool, cut);
                (pool - second, Some(second), net - pool)
            }
            (Some(cut), SecondSource::Company) => {
                let first = fl(net, share);
                let second = fl(net - first, cut);
                (first, Some(second), net - first - second)
            }
        };
        (primary, second, company) = (Some(p), s, c);
    }
    let vat = if terms.vat_registered {
        hu(net, VAT_RATE_BP)
    } else {
        0
    };
    Ok(Calculation {
        gross_fils: out(gross)?,
        partner_fils: out(partner)?,
        net_fils: out(net)?,
        primary_fils: primary.map(out).transpose()?,
        second_fils: second.map(out).transpose()?,
        company_fils: out(company)?,
        vat_fils: out(vat)?,
    })
}

#[cfg(test)]
#[path = "calc_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "calc_property_tests.rs"]
mod property_tests;

#[cfg(test)]
#[path = "calc_receipt_tests.rs"]
mod receipt_tests;
