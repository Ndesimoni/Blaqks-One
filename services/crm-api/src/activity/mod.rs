//! The workspace activity feed (docs/team-activity-design.md): a read module that merges
//! `records::activity::page`, `team::audit::page` and `integrations::activity::page`. It
//! owns no tables.
pub mod cursor;
pub mod dates;
pub mod handlers;
mod organisation;
pub mod query;
mod respond;
pub mod routes;
mod vocabulary;
pub mod window;
