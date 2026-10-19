//! Cross-company agreements (docs/agreements-design.md): own schema, frozen
//! revision snapshots, participant-scoped commands and insert-only evidence.
pub mod access;
mod command;
pub mod errors;
mod evidence;
pub mod handlers;
mod ledger;
mod lifecycle;
pub mod model;
mod respond;
mod revise;
pub mod routes;
mod rows;
mod store;
mod terms;
mod wire;
mod write;

#[cfg(test)]
mod evidence_tests;
#[cfg(test)]
mod tests;
