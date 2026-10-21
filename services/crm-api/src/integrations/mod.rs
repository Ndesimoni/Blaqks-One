//! Channel connections (docs/messaging-design.md §3, packet X1): own schema,
//! Admin-only registry, sealed credentials and insert-only redacted events.
pub mod access;
pub mod activity;
mod addresses;
mod commands;
mod company;
mod credential;
mod crypto;
mod google;
pub mod handlers;
pub mod mail;
pub mod mail_sync;
mod mailbox;
pub mod model;
mod provider;
pub mod revocation;
pub mod routes;
mod sendgrid;
mod store;
mod store_write;
mod vocabulary;
pub mod webhooks;
mod wire;

/// Called by `team` when an Admin is archived; see `company.rs`.
pub use company::archived as company_archived;
/// Whether a member may send and own email: the Admin, or staff with the email grant.
pub use mailbox::may_connect as mailbox_allowed;
pub use mailbox::revoke_soon;
/// Called by `team` when members leave or lose the email grant; see `revocation.rs`.
pub use revocation::departure;
/// The one connection read other modules may call: channel states, no credentials.
pub use store::channel_states;

#[cfg(test)]
mod tests;
