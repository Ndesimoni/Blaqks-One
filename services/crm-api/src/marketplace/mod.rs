//! Broker marketplace (docs/broker-marketplace.md §13–§15, packets MK1a and MK1b): company
//! eligibility, the company switch, the platform's decisions, and joining with terms, consent
//! and a profile. The module owns the `marketplace` schema and never reads or writes another
//! module's tables: it calls `records` for counts, `workspaces` for the company, `auth` for
//! live membership and names, and `media` for profile photos.
pub mod accept;
pub mod acceptances;
pub mod application;
pub mod company;
pub mod decision;
pub mod decisions;
pub mod eligibility;
pub mod errors;
pub mod events;
pub mod free_text;
pub mod gate;
pub mod join;
pub mod leave;
pub mod limits;
pub mod me;
pub mod photo;
pub mod profile;
pub mod profile_read;
pub mod profile_view;
pub mod profiles;
pub mod routes;
pub mod state;
pub mod terms;
pub mod terms_read;
pub mod visibility;

#[cfg(test)]
mod profile_tests;
#[cfg(test)]
mod tests;
