//! Local-development public sign-up. This leaf domain owns pending requests and its
//! transactional outbox, then composes auth, tenancy and team contracts at verify.
pub mod bot;
pub mod cleanup;
pub mod client;
mod code;
mod delivery;
mod identity;
mod jobs;
mod limits;
mod model;
mod resend;
mod resend_response;
mod retry;
pub mod routes;
mod start;
mod turnstile;
mod validation;
mod verify;
mod verify_error;
mod verify_store;
pub mod worker;

use crate::config::SignupMode;
use std::sync::Arc;

pub struct Services {
    pub bot: Arc<dyn bot::BotCheck>,
    pub clients: client::ClientKeys,
    pub delivery: Arc<dyn delivery::Delivery>,
    pub password_workers: Arc<tokio::sync::Semaphore>,
}

impl Services {
    pub fn new(mode: SignupMode, clients: client::ClientKeys, bot: Arc<dyn bot::BotCheck>) -> Self {
        Self {
            bot,
            clients,
            delivery: Arc::new(delivery::DevOutbox::new(mode)),
            password_workers: Arc::new(tokio::sync::Semaphore::new(2)),
        }
    }
}

#[cfg(test)]
#[path = "delivery_tests.rs"]
mod delivery_tests;
#[cfg(test)]
mod test_support;
#[cfg(test)]
mod tests;
#[cfg(test)]
#[path = "worker_tests.rs"]
mod worker_tests;
