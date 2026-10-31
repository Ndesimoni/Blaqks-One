//! WhatsApp through the company's Twilio account (packet W1a, docs/whatsapp-design.md §4
//! and §16). `shape` checks what the Admin pastes before any call, `api` makes Twilio's
//! account and sender reads, `senders` turns Twilio's sender list into canonical phones,
//! and `connect` proves an account for the generic connect and reconnect routes.
pub mod api;
pub mod connect;
pub mod senders;
pub mod shape;
