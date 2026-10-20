//! Channel connections (docs/messaging-design.md §3, packet X1): own schema,
//! Admin-only registry, sealed credentials and insert-only redacted events.
pub mod access;
pub mod activity;
mod commands;
mod crypto;
pub mod handlers;
pub mod model;
mod provider;
pub mod routes;
mod store;
mod store_write;
mod vocabulary;
pub mod webhooks;
mod wire;

#[cfg(test)]
mod tests;
