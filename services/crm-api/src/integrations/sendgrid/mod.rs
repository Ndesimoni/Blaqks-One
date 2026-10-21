//! Company email through Twilio SendGrid (decision D4, packet E3, docs/sendgrid-design.md).
//! E3a: the company connection with its scope and domain proof, and the one-system rule.
//! Sending (E3b) and incoming mail (E3c) use the same adapter.
pub mod account;
pub mod api;
pub mod connect;
