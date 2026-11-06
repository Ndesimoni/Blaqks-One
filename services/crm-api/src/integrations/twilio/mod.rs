//! WhatsApp through the company's Twilio account (packets W1a and W1b,
//! docs/whatsapp-design.md §4–§8, §16 and §18). `shape` checks what the Admin pastes
//! before any call, `api` makes Twilio's account and sender reads, `senders` turns
//! Twilio's sender list into canonical phones, `connect` proves an account for the generic
//! connect and reconnect routes, `content` and `templates` read and parse message
//! templates, `messages` sends one message, `codes` maps Twilio's answers, and `signature`
//! checks a webhook's signature.
pub mod api;
pub mod codes;
pub mod connect;
pub mod content;
pub mod messages;
mod pages;
pub mod placeholders;
pub mod sender_page;
pub mod senders;
pub mod shape;
pub mod signature;
mod status;
pub mod templates;
