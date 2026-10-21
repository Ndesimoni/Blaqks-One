//! Company email through Twilio SendGrid (decision D4, packet E3, docs/sendgrid-design.md).
//! E3a: the company connection with its scope and domain proof, and the one-system rule.
//! E3b: sending from each member's own address. E3c: incoming mail through Inbound Parse.
pub mod account;
pub mod api;
pub mod connect;
pub mod events;
pub mod inbound;
pub mod inbound_event;
pub mod inbound_files;
pub mod multipart;
pub mod parse_api;
pub mod payload;
pub mod send;
pub mod sender;
pub mod trust;
pub mod webhook_api;
pub mod webhooks;
