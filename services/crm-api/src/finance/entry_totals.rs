//! Payment and expense figures for team totals (finance-design §6.2): approved expenses
//! and the rows awaiting a decision, over the rows in scope (and the `?agent=` filter).
use super::{expenses::row::ExpenseRow, payments::row::PaymentRow};
use serde_json::{json, Value};

pub fn add(totals: &mut Value, payments: &[PaymentRow], expenses: &[ExpenseRow]) {
    let approved: i128 = expenses
        .iter()
        .filter(|row| row.state.status == "approved")
        .map(|row| i128::from(row.state.amount_fils))
        .sum();
    let pending = payments
        .iter()
        .map(|row| &row.state)
        .chain(expenses.iter().map(|row| &row.state))
        .filter(|state| state.status == "pending")
        .count();
    totals["expensesApprovedFils"] = json!(i64::try_from(approved).unwrap_or(i64::MAX));
    totals["pendingCount"] = json!(pending);
}
