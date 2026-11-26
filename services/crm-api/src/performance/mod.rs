//! Performance targets (docs/backend-foundation.md, docs/service-boundaries.md): monthly team
//! and member targets in `crm_targets`, owned by this module. Actuals are never computed or
//! served here; the frontend derives them from records and finance the caller already sees.
pub mod access;
pub mod errors;
pub mod input;
pub mod routes;
pub mod rows;
pub mod store;
pub mod targets;
pub mod visibility;
