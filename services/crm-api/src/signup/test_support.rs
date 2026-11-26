//! Shared fixtures for the ignored sign-up worker tests.
use super::delivery::{Delivery, DeliveryError, Message};
use crate::auth::session;
use sqlx::PgPool;
use std::{
    future::Future,
    pin::Pin,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
};
use uuid::Uuid;

/// Clears sign-up data between sequential worker tests.
pub async fn reset(pool: &PgPool) {
    sqlx::query("TRUNCATE crm_signup_outbox, crm_signup_requests CASCADE")
        .execute(pool)
        .await
        .unwrap();
}

/// Inserts a pending code request and returns its outbox job ID.
pub async fn fixture(pool: &PgPool) -> Uuid {
    let email = format!("worker-{}@example.test", Uuid::new_v4());
    let request: Uuid = sqlx::query_scalar(
        r#"INSERT INTO crm_signup_requests
           (ticket_hash,email,existing_account,account_type,name,phone,password_hash,
            language,terms_version,privacy_version,code_hash)
           VALUES ($1,$2,false,'brokerage','Synthetic','+971501234567','hash','en',
            'terms','privacy',$3) RETURNING id"#,
    )
    .bind(session::digest(&Uuid::new_v4().to_string()))
    .bind(email)
    .bind(session::digest("synthetic-code"))
    .fetch_one(pool)
    .await
    .unwrap();
    sqlx::query_scalar(
        "INSERT INTO crm_signup_outbox(request_id,kind,code) VALUES($1,'code','012345') \
         RETURNING id",
    )
    .bind(request)
    .fetch_one(pool)
    .await
    .unwrap()
}

pub struct Counting(pub Arc<AtomicUsize>);

impl Delivery for Counting {
    fn deliver<'a>(
        &'a self,
        _message: Message,
    ) -> Pin<Box<dyn Future<Output = Result<(), DeliveryError>> + Send + 'a>> {
        Box::pin(async move {
            self.0.fetch_add(1, Ordering::SeqCst);
            Ok(())
        })
    }
}

pub struct RetryOnce;

impl Delivery for RetryOnce {
    fn deliver<'a>(
        &'a self,
        _message: Message,
    ) -> Pin<Box<dyn Future<Output = Result<(), DeliveryError>> + Send + 'a>> {
        Box::pin(async {
            Err(DeliveryError::Retry {
                after: None,
                message: "transport retry",
            })
        })
    }
}

pub struct Permanent;

impl Delivery for Permanent {
    fn deliver<'a>(
        &'a self,
        _message: Message,
    ) -> Pin<Box<dyn Future<Output = Result<(), DeliveryError>> + Send + 'a>> {
        Box::pin(async {
            Err(DeliveryError::Permanent {
                message: "permanent delivery failure",
            })
        })
    }
}
