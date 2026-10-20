//! The worker's inbound loop: claims a received event, opens its sealed body and hands it
//! to the [`Sink`] (the Inbox), then deletes the body. Without a sink the loop is not
//! started and events wait, sealed, for at most the 30-day receipt retention.
use super::{
    cleanup,
    inbound_store::{self as stored, Claimed},
    message::{parse_stub, Inbound},
    receipt::STUB,
};
use crate::{
    config::messaging_settings::MessagingKey, integrations::crypto, outbox::worker::pause,
};
use sqlx::PgPool;
use std::{future::Future, pin::Pin, sync::Arc, time::Duration};
use tokio::{sync::watch, task::JoinHandle};
use uuid::Uuid;

pub const MAX_ATTEMPTS: i32 = 5;
pub const LEASE_SECONDS: i64 = 60;
const POLL: Duration = Duration::from_millis(500);
const CLEANUP_EVERY: Duration = Duration::from_secs(3600);
/// A sink call ends well inside the lease, so a live worker never loses it (X2-S4).
pub const SINK_TIMEOUT: Duration = Duration::from_secs(30);

/// A verified provider event, parsed into the provider-neutral message. It lives only in
/// memory; the sealed body is deleted once the event is settled.
pub struct Event {
    pub receipt_id: Uuid,
    pub workspace_id: String,
    pub connection_id: Uuid,
    pub channel: String,
    pub message: Inbound,
}

#[derive(Debug, PartialEq)]
pub enum SinkError {
    /// Try again later, up to [`MAX_ATTEMPTS`].
    Retry,
    /// Give up; the code is a fixed snake_case word.
    Permanent(&'static str),
}

pub type SinkFuture<'a> = Pin<Box<dyn Future<Output = Result<(), SinkError>> + Send + 'a>>;

/// Receives verified events. It must be idempotent per receipt.
pub trait Sink: Send + Sync {
    fn accept<'a>(&'a self, event: &'a Event) -> SinkFuture<'a>;
}

/// Opens the sealed body and parses it with the receipt's provider format.
fn decode(claimed: &Claimed, key: &MessagingKey) -> Result<Event, &'static str> {
    let aad = crypto::staging_aad(
        &claimed.workspace_id,
        &claimed.id.to_string(),
        &claimed.provider,
        claimed.key_version,
    );
    let body = (claimed.key_version == key.version)
        .then(|| crypto::open(&key.bytes, &aad, &claimed.sealed).ok())
        .flatten()
        .ok_or("unreadable")?;
    let message = match claimed.provider.as_str() {
        STUB => parse_stub(&body)?,
        _ => return Err("unsupported_provider"),
    };
    Ok(Event {
        receipt_id: claimed.id,
        workspace_id: claimed.workspace_id.clone(),
        connection_id: claimed.connection_id,
        channel: claimed.channel.clone(),
        message,
    })
}

/// Processes at most one event; `true` when one was claimed.
pub async fn process_one(pool: &PgPool, key: &MessagingKey, sink: &dyn Sink, owner: Uuid) -> bool {
    if stored::exhaust(pool, MAX_ATTEMPTS).await.is_err() {
        eprintln!("CRM webhook attempts sweep failed.");
    }
    let Ok(Some(claimed)) = stored::claim(pool, owner, LEASE_SECONDS, MAX_ATTEMPTS).await else {
        return false;
    };
    let settle = |outcome: &'static str, code: Option<&'static str>| {
        stored::settle(pool, claimed.id, owner, outcome, code)
    };
    let result = if claimed.disconnected {
        settle("rejected", Some("disconnected")).await
    } else {
        match decode(&claimed, key) {
            Err(code) => settle("failed", Some(code)).await,
            Ok(event) => {
                let answer = tokio::time::timeout(SINK_TIMEOUT, sink.accept(&event))
                    .await
                    .unwrap_or(Err(SinkError::Retry));
                match answer {
                    Ok(()) => settle("processed", None).await,
                    Err(SinkError::Retry) if claimed.attempts < MAX_ATTEMPTS => {
                        stored::release(pool, claimed.id, owner).await
                    }
                    Err(SinkError::Retry) => settle("failed", Some("sink_retries_exhausted")).await,
                    Err(SinkError::Permanent(code)) => {
                        settle("failed", Some(stored::safe(code))).await
                    }
                }
            }
        }
    };
    if result.is_err() {
        eprintln!("CRM webhook event could not be settled.");
    }
    true
}

/// Spawns the receipt purge and, when a sink exists, the processing loop.
pub fn spawn(
    pool: PgPool,
    key: MessagingKey,
    sink: Option<Arc<dyn Sink>>,
    shutdown: watch::Receiver<bool>,
) -> Vec<JoinHandle<()>> {
    let mut handles = vec![tokio::spawn(purge_loop(pool.clone(), shutdown.clone()))];
    if let Some(sink) = sink {
        let mut shutdown = shutdown;
        handles.push(tokio::spawn(async move {
            let owner = Uuid::new_v4();
            while !*shutdown.borrow() {
                if !process_one(&pool, &key, sink.as_ref(), owner).await
                    && pause(&mut shutdown, POLL).await
                {
                    break;
                }
            }
        }));
    }
    handles
}

async fn purge_loop(pool: PgPool, mut shutdown: watch::Receiver<bool>) {
    while !*shutdown.borrow() {
        if cleanup::purge(&pool).await.is_err() {
            eprintln!("CRM webhook receipt cleanup failed.");
        }
        if pause(&mut shutdown, CLEANUP_EVERY).await {
            break;
        }
    }
}
