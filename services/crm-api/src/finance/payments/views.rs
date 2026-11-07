//! PaymentView (finance-design §6.2): the shared approval fields plus the deal ID, receipt
//! date, amount ex VAT, server-computed VAT and their total.
use super::row::PaymentRow;
use crate::finance::{deals::views::Viewer, entry_view};
use serde_json::{json, Value};

pub fn view(row: &PaymentRow, viewer: &Viewer) -> Value {
    let mut value = entry_view::shared(&row.state, viewer);
    let total = row.state.amount_fils.saturating_add(row.vat_fils);
    value["paymentId"] = json!(row.state.legacy_id);
    value["dealId"] = json!(row.deal_ref);
    value["receiptDate"] = json!(row.receipt_date);
    value["vatFils"] = json!(row.vat_fils);
    value["totalFils"] = json!(total);
    value["reference"] = json!(row.reference);
    value
}
