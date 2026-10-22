//! Cross-company agreements (docs/agreements-design.md): own schema, frozen
//! revision snapshots, participant-scoped commands and insert-only evidence.
pub mod access;
mod command;
mod detail;
pub mod errors;
mod evidence;
pub mod handlers;
pub mod handover;
pub mod handover_decide;
pub mod handover_terms;
mod history;
mod ledger;
mod lifecycle;
mod limits;
pub mod model;
mod parties;
mod recipients;
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
mod handover_tests;
#[cfg(test)]
mod tests;
