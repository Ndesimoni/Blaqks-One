//! The shared Inbox (docs/messaging-design.md §2–§6, packet X3): conversations, messages,
//! internal notes, read state, blocks, lead rules and redacted events in schema `inbox`.
//! It matches senders and creates leads only through records functions, and receives
//! verified events from `integrations` as the worker's sink.
pub mod access;
pub mod blocks;
pub mod change;
pub mod commands;
pub mod events;
pub mod intake;
pub mod intake_email;
mod intake_store;
pub mod leads;
pub mod list;
pub mod matching;
pub mod normalize;
pub mod notes;
pub mod read;
pub mod routes;
pub mod rules;
pub mod rules_api;
pub mod send;
pub mod summary;
pub mod triage;
pub mod view;

#[cfg(test)]
mod intake_fixtures;
#[cfg(test)]
mod intake_state_tests;
#[cfg(test)]
mod intake_tests;
