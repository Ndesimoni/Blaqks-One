//! Sharing a listing with one named agent at another company (docs/record-sharing.md R2,
//! packet R2a). The sender's listing is frozen into an insert-only snapshot with copies of
//! its photos; the agent sees twelve facts until they accept, then the listing until its
//! end date; every step is evidence of the introduction. Never the Super Admin.
mod access;
mod actions;
mod co_broking;
mod co_broking_view;
mod create;
mod create_checks;
mod dates;
mod digest;
mod evidence;
mod extend;
mod files;
mod lifecycle;
mod places;
mod preview;
mod read;
mod review;
pub mod routes;
mod snapshot;
mod snapshot_store;
mod step;
mod store;
mod view;
pub mod waiting;

pub use lifecycle::{end_for_company, end_for_member};

#[cfg(test)]
mod tests;
