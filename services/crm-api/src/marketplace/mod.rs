//! Broker marketplace (docs/broker-marketplace.md §13–§15, packets MK1a and MK1b): company
//! eligibility, the company switch, the platform's decisions, and joining with terms, consent
//! and a profile. The module owns the `marketplace` schema and never reads or writes another
//! module's tables: it calls `records` for counts, `workspaces` for the company, `auth` for
//! live membership and names, and `media` for profile photos.
pub mod accept;
pub mod acceptances;
pub mod activity;
pub mod answer_access;
pub mod answers_post;
pub mod answers_preview;
pub mod answers_read;
pub mod answers_reject;
pub mod answers_routes;
pub mod answers_send;
pub mod application;
pub mod bands;
pub mod board;
pub mod board_filters;
pub mod board_limits;
pub mod company;
pub mod conversation_access;
pub mod conversation_routes;
pub mod conversation_start;
pub mod conversation_store;
pub mod decision;
pub mod decisions;
pub mod eligibility;
pub mod errors;
pub mod events;
pub mod free_text;
pub mod gate;
pub mod interaction_routes;
pub mod join;
pub mod leave;
pub mod lifecycle_routes;
pub mod lifecycle_store;
pub mod limits;
pub mod matching;
pub mod me;
pub mod notices;
pub mod photo;
pub mod profile;
pub mod profile_read;
pub mod profile_view;
pub mod profiles;
pub mod request;
pub mod request_actions;
pub mod request_draft;
pub mod request_edit;
pub mod request_rules;
pub mod request_view;
pub mod requests;
pub mod requests_board;
pub mod requests_close;
pub mod requests_edit;
pub mod requests_mine;
pub mod requests_post;
pub mod routes;
pub mod sources;
pub mod state;
pub mod terms;
pub mod terms_read;
pub mod visibility;

#[cfg(test)]
mod matching_tests;
#[cfg(test)]
mod profile_tests;
#[cfg(test)]
mod tests;
