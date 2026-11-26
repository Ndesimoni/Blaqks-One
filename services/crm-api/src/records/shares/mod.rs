//! Sharing one record with a colleague (docs/record-sharing.md R1): the holder or the Admin
//! offers a client, property or contact to an assigned-only colleague, who accepts a
//! view-only copy (a `colleague` keep) or declines. Shares end when the record changes
//! holder, when either member leaves, or when stopped. Super Admin excluded.
pub mod access;
pub mod actions;
pub mod candidates;
pub mod create;
pub mod lifecycle;
pub mod locks;
pub mod read;
pub mod routes;
pub mod rules;
pub mod store;
pub mod view;

pub use lifecycle::{end_for_member, end_held_legacy_to, end_to};
