//! Company email through Twilio SendGrid (decision D4, packet E3, docs/sendgrid-design.md).
//! E3a: the company connection with its scope and domain proof, and the one-system rule.
//! E3b: sending from each member's own address. Incoming mail (E3c) uses the same adapter.
pub mod account;
pub mod api;
pub mod connect;
pub mod events;
pub mod payload;
pub mod send;
pub mod sender;
pub mod webhook_api;
pub mod webhooks;
