//! ExpenseView (finance-design §6.2): the shared approval fields plus who incurred it, the
//! date paid, the supplier details, the linked property and the https receipt link.
use super::row::ExpenseRow;
use crate::finance::{deals::views::Viewer, entry_view};
use serde_json::{json, Value};

pub fn view(row: &ExpenseRow, viewer: &Viewer) -> Value {
    let mut value = entry_view::shared(&row.state, viewer);
    value["expenseId"] = json!(row.state.legacy_id);
    value["incurredBy"] = json!({"id": row.incurred_by, "name": row.incurred_name});
    value["datePaid"] = json!(row.date_paid);
    value["category"] = json!(row.category);
    value["supplier"] = json!(row.supplier);
    value["campaignReference"] = json!(row.campaign_reference);
    value["propertyId"] = json!(row.property_ref);
    value["receiptUrl"] = json!(row.receipt_url);
    value
}
