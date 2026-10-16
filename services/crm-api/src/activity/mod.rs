//! The workspace activity feed (docs/team-activity-design.md): a read module that merges
//! `records::activity::page` and `team::audit::page`. It owns no tables.
pub mod cursor;
pub mod dates;
pub mod handlers;
pub mod query;
pub mod routes;
pub mod window;
