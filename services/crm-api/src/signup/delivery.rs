use crate::{config::SignupMode, error::ApiResult};
use sqlx::PgPool;
use std::{future::Future, pin::Pin};
use uuid::Uuid;

pub struct Message {
    pub id: Uuid,
    pub code: Option<String>,
    pub masked_email: String,
    pub expires_at: String,
}

pub trait Delivery: Send + Sync {
    fn deliver<'a>(
        &'a self,
        message: Message,
    ) -> Pin<Box<dyn Future<Output = ApiResult<()>> + Send + 'a>>;
}

pub struct DevOutbox {
    mode: SignupMode,
    pool: PgPool,
}

impl DevOutbox {
    pub fn new(mode: SignupMode, pool: PgPool) -> Self {
        Self { mode, pool }
    }
}

impl Delivery for DevOutbox {
    fn deliver<'a>(
        &'a self,
        message: Message,
    ) -> Pin<Box<dyn Future<Output = ApiResult<()>> + Send + 'a>> {
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
                sqlx::query("UPDATE crm_signup_outbox SET delivered_at=now() WHERE id=$1")
                    .bind(message.id)
                    .execute(&self.pool)
                    .await?;
            }
            Ok(())
        })
    }
}
