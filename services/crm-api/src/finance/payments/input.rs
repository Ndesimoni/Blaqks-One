//! Strict payment bodies (finance-design §6.2, §13 M-F4, L-F3): whole fils ex VAT, ISO
//! receipt dates, server-issued IDs and a deal that never changes after create.
use crate::{
    error::{ApiError, ApiResult},
    finance::{
        deals::fields::reference,
        entry_wire::{self, ISSUED},
        errors::ENTRY_FIXED,
        wire,
    },
};
use serde_json::Value;

pub const INVALID: &str = "Provide valid payment details.";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PaymentInput {
    /// Required on create; on a PATCH only an echo of the stored deal is accepted.
    pub deal_ref: Option<String>,
    pub receipt_date: String,
    pub amount_fils: i64,
    pub reference: Option<String>,
    pub notes: Option<String>,
}

pub fn parse(value: &Value, creating: bool) -> ApiResult<PaymentInput> {
    if creating && value.get("paymentId").is_some() {
        return Err(ApiError::invalid(ISSUED));
    }
    let required: &[&str] = match creating {
        true => &["dealId", "receiptDate", "amountFils"],
        false => &["receiptDate", "amountFils"],
    };
    let optional: &[&str] = match creating {
        true => &["reference", "notes"],
        false => &["reference", "notes", "dealId"],
    };
    let map = entry_wire::keys(value, required, optional, INVALID)?;
    let deal_ref = match map.get("dealId") {
        None => None,
        Some(deal) => Some(reference(Some(deal), INVALID)?.ok_or(ApiError::invalid(INVALID))?),
    };
    Ok(PaymentInput {
        deal_ref,
        receipt_date: wire::date(&map["receiptDate"])?,
        amount_fils: entry_wire::amount(&map["amountFils"])?,
        reference: entry_wire::text(map.get("reference"), 200, INVALID)?,
        notes: entry_wire::text(map.get("notes"), 4000, INVALID)?,
    })
}

/// A PATCH may echo the stored deal; any other deal is refused (M-F4).
pub fn ensure_same_deal(input: &PaymentInput, stored: &str) -> ApiResult<()> {
    match input.deal_ref.as_deref() {
        Some(deal) if deal != stored => Err(ApiError::invalid(ENTRY_FIXED)),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn payment_bodies_are_strict() {
        let body = json!({"dealId": "DL-001", "receiptDate": "2026-10-01",
            "amountFils": 2_450_000, "reference": " INV-1 ", "notes": null});
        let input = parse(&body, true).unwrap();
        assert_eq!(input.reference.as_deref(), Some("INV-1"));
        assert_eq!(input.notes, None);
        let mut issued = body.clone();
        issued["paymentId"] = json!("PM-001");
        assert_eq!(parse(&issued, true).unwrap_err().1, ISSUED);
        let mut extra = body.clone();
        extra["vatFils"] = json!(1);
        assert_eq!(parse(&extra, true).unwrap_err().1, INVALID);
        let update = json!({"receiptDate": "2026-10-01", "amountFils": 5, "dealId": "DL-002"});
        let parsed = parse(&update, false).unwrap();
        assert_eq!(
            ensure_same_deal(&parsed, "DL-001").unwrap_err().1,
            ENTRY_FIXED
        );
        assert!(ensure_same_deal(&parsed, "DL-002").is_ok());
        assert!(parse(&json!({"receiptDate": "2026-10-01"}), false).is_err());
        let float = json!({"receiptDate": "2026-10-01", "amountFils": 10.5});
        assert_eq!(parse(&float, false).unwrap_err().1, entry_wire::MONEY);
    }
}
