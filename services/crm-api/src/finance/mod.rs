//! Connected finance (docs/finance-design.md): typed tables outside the generic record
//! model, money in fils, rates in basis points, Admin-only settings and agreements,
//! deals, and payments and expenses that count only once approved.
pub mod access;
pub mod admin;
pub mod agreements;
pub mod agreements_delete;
pub mod agreements_store;
pub mod approval;
pub mod approval_rules;
pub mod calc;
pub mod deals;
pub mod decisions;
pub mod departure;
pub mod entry;
pub mod entry_edit;
pub mod entry_sql;
pub mod entry_totals;
pub mod entry_view;
pub mod entry_wire;
pub mod errors;
pub mod events;
pub mod expenses;
pub mod history;
pub mod overview;
pub mod payments;
pub mod receipts;
pub mod references;
pub mod routes;
pub mod selection;
pub mod settings;
pub mod settings_store;
pub mod statement;
pub mod wire;
