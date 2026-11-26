//! Platform metrics for Blaqks One (BO1d, docs/blaqks-one-console.md §3 item 4 and §3a).
//! Owns schema `platform_metrics`: the platform event log (`crm_platform_events`, written
//! by every module through `events::record` inside its own transaction) and the daily
//! active users (`crm_user_active_days`, written through `active_days::mark` when a session
//! is used). The dashboard reads everything else through count functions of the modules
//! that own the data (service-boundaries rule 3): counts and platform-wide sums only, and
//! per company usage figures without money. A leaf module: it depends on no business
//! domain for writing, so any module may record events.
pub mod active_days;
mod companies;
pub mod events;
mod figures;
mod gather;
mod growth;
mod handler;
mod log;
pub mod names;
mod period;
pub mod routes;
mod totals;

pub use events::{record, Event, Source};
