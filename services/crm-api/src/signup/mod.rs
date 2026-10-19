//! Local-development public sign-up. This leaf domain owns pending requests and its
//! transactional outbox, then composes auth, tenancy and team contracts at verify.
pub mod bot;
pub mod cleanup;
mod code;
mod delivery;
mod identity;
mod limits;
mod model;
mod resend;
mod resend_response;
pub mod routes;
mod start;
mod validation;
mod verify;
mod verify_error;
mod verify_store;

use crate::config::SignupMode;
use sqlx::PgPool;
use std::sync::Arc;

pub struct Services {
    pub bot: Arc<dyn bot::BotCheck>,
    pub delivery: Arc<dyn delivery::Delivery>,
    pub password_workers: Arc<tokio::sync::Semaphore>,
}

impl Services {
    pub fn new(mode: SignupMode, pool: PgPool) -> Self {
        Self {
            bot: Arc::new(bot::LocalBypass::new(mode)),
            delivery: Arc::new(delivery::DevOutbox::new(mode, pool)),
            password_workers: Arc::new(tokio::sync::Semaphore::new(2)),
        }
    }
}

#[cfg(test)]
mod tests;
