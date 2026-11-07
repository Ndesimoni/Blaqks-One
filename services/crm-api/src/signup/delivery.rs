use crate::config::SignupMode;
use std::{future::Future, pin::Pin, time::Duration};
use uuid::Uuid;

pub struct Message {
    pub id: Uuid,
    pub code: Option<String>,
    pub masked_email: String,
    pub expires_at: String,
}

/// A transport failure. Messages are fixed text, never provider responses, so no code,
/// address or credential can reach the job row or the log.
#[derive(Debug)]
pub enum DeliveryError {
    Retry {
        after: Option<Duration>,
        message: &'static str,
    },
    Permanent {
        message: &'static str,
    },
}

pub trait Delivery: Send + Sync {
    fn deliver<'a>(
        &'a self,
        message: Message,
    ) -> Pin<Box<dyn Future<Output = Result<(), DeliveryError>> + Send + 'a>>;
}

/// Local-development transport: prints the code and reports success. Database state is the
/// worker's responsibility, so a retry cannot mark a failed attempt as delivered.
pub struct DevOutbox {
    mode: SignupMode,
}

impl DevOutbox {
    pub fn new(mode: SignupMode) -> Self {
        Self { mode }
    }
}

impl Delivery for DevOutbox {
    fn deliver<'a>(
        &'a self,
        message: Message,
    ) -> Pin<Box<dyn Future<Output = Result<(), DeliveryError>> + Send + 'a>> {
        Box::pin(async move {
            if self.mode == SignupMode::Local {
                if let Some(code) = &message.code {
                    eprintln!(
                        "[dev-outbox] sign-up code {code} for {}, expires {}",
                        message.masked_email, message.expires_at
                    );
                } else {
                    eprintln!(
                        "[dev-outbox] sign-up account notice for {}",
                        message.masked_email
                    );
                }
            }
            let _ = message.id;
            Ok(())
        })
    }
}
