//! Leased sign-up delivery jobs. Sign-up owns both the message data and these state changes;
//! no other module reads `crm_signup_outbox`.
pub mod claim;
pub mod deliver;

pub use claim::claim;
pub use deliver::run;
