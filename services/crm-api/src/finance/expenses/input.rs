//! Strict expense bodies (finance-design §6.2, §13 L-F3, L-F5): whole fils as paid, ISO
//! dates, https receipt links and server-issued IDs. Only an Admin names `incurredBy`.
use crate::{
    error::{ApiError, ApiResult},
    finance::{
        deals::fields::reference,
        entry_wire::{self, ISSUED},
        wire,
    },
};
use serde_json::Value;
use uuid::Uuid;

pub const INVALID: &str = "Provide valid expense details.";
pub const FOR_YOURSELF: &str = "Expenses are recorded for yourself.";
const OPTIONAL: [&str; 7] = [
    "category",
    "supplier",
    "campaignReference",
    "propertyId",
    "receiptUrl",
    "notes",
    "incurredBy",
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ExpenseInput {
    pub date_paid: String,
    pub amount_fils: i64,
    pub category: Option<String>,
    pub supplier: Option<String>,
    pub campaign_reference: Option<String>,
    pub property_ref: Option<String>,
    pub receipt_url: Option<String>,
    pub notes: Option<String>,
    /// Admin only; `None` keeps the stored owner (or the creator on create).
    pub incurred_by: Option<Uuid>,
}

/// `manage`: the caller is an Admin; staff naming anyone is 400 (step 3).
pub fn parse(value: &Value, creating: bool, manage: bool) -> ApiResult<ExpenseInput> {
    if creating && value.get("expenseId").is_some() {
        return Err(ApiError::invalid(ISSUED));
    }
    let map = entry_wire::keys(value, &["datePaid", "amountFils"], &OPTIONAL, INVALID)?;
    let incurred_by = match map.get("incurredBy") {
        None | Some(Value::Null) => None,
        Some(_) if !manage => return Err(ApiError::invalid(FOR_YOURSELF)),
        Some(id) => Some(wire::uuid(id, INVALID)?),
    };
    Ok(ExpenseInput {
        date_paid: wire::date(&map["datePaid"])?,
        amount_fils: entry_wire::amount(&map["amountFils"])?,
        category: entry_wire::text(map.get("category"), 100, INVALID)?,
        supplier: entry_wire::text(map.get("supplier"), 200, INVALID)?,
        campaign_reference: entry_wire::text(map.get("campaignReference"), 200, INVALID)?,
        property_ref: reference(map.get("propertyId"), INVALID)?,
        receipt_url: entry_wire::receipt_url(map.get("receiptUrl"))?,
        notes: entry_wire::text(map.get("notes"), 4000, INVALID)?,
        incurred_by,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn expense_bodies_are_strict_and_staff_record_for_themselves() {
        let body = json!({"datePaid": "2026-10-01", "amountFils": 150_000,
            "category": "Marketing", "receiptUrl": "https://files.example.test/r.pdf"});
        let input = parse(&body, true, false).unwrap();
        assert_eq!(input.category.as_deref(), Some("Marketing"));
        assert_eq!(input.incurred_by, None);
        let mut named = body.clone();
        named["incurredBy"] = json!(Uuid::nil());
        assert_eq!(parse(&named, true, false).unwrap_err().1, FOR_YOURSELF);
        assert_eq!(
            parse(&named, true, true).unwrap().incurred_by,
            Some(Uuid::nil())
        );
        named["incurredBy"] = json!("nope");
        assert_eq!(parse(&named, true, true).unwrap_err().1, INVALID);
        let mut issued = body.clone();
        issued["expenseId"] = json!("EX-001");
        assert_eq!(parse(&issued, true, true).unwrap_err().1, ISSUED);
        let mut insecure = body.clone();
        insecure["receiptUrl"] = json!("http://files.example.test/r.pdf");
        assert_eq!(
            parse(&insecure, true, false).unwrap_err().1,
            entry_wire::RECEIPT
        );
        let mut unknown = body;
        unknown["status"] = json!("approved");
        assert_eq!(parse(&unknown, false, true).unwrap_err().1, INVALID);
    }
}
