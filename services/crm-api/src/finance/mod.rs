//! Connected finance (docs/finance-design.md): typed tables outside the generic record
//! model, money in fils, rates in basis points, Admin-only settings and agreements.
pub mod access;
pub mod admin;
pub mod agreements;
pub mod agreements_delete;
pub mod agreements_store;
pub mod calc;
pub mod deals;
pub mod departure;
pub mod errors;
pub mod events;
pub mod overview;
pub mod receipts;
pub mod references;
pub mod routes;
pub mod selection;
pub mod settings;
pub mod settings_store;
pub mod wire;
