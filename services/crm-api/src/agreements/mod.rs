//! Cross-company agreements (docs/agreements-design.md): own schema, frozen
//! revision snapshots, participant-scoped commands and insert-only evidence.
pub mod access;
mod command;
mod detail;
pub mod errors;
mod evidence;
pub mod handlers;
pub mod handover;
mod handover_adjust;
mod handover_approval;
pub mod handover_decide;
mod handover_read;
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
mod waiting;
mod wire;
mod write;

#[cfg(test)]
mod approval_tests;
#[cfg(test)]
mod evidence_tests;
#[cfg(test)]
mod handover_tests;
#[cfg(test)]
mod tests;
