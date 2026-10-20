//! Delivery loops for the messaging worker process. The API process never claims jobs.
use super::{
    claim, cleanup,
    model::{Domain, LEASE_SECONDS},
    run,
};
use sqlx::PgPool;
use std::{sync::Arc, time::Duration};
use tokio::{sync::watch, task::JoinHandle};
use uuid::Uuid;

pub const CONCURRENCY: usize = 2;
const POLL: Duration = Duration::from_millis(500);
const CLEANUP_EVERY: Duration = Duration::from_secs(3600);

/// The domains this process can send, by name.
pub type Domains = Arc<Vec<Arc<dyn Domain>>>;

/// Spawns bounded delivery loops plus one housekeeping loop. Each delivery loop has its own
/// lease identity; shutdown stops new claims and lets the in-flight send finish.
pub fn spawn(
    pool: PgPool,
    domains: Domains,
    shutdown: watch::Receiver<bool>,
) -> Vec<JoinHandle<()>> {
    let mut handles: Vec<JoinHandle<()>> = (0..CONCURRENCY)
        .map(|_| tokio::spawn(deliver(pool.clone(), domains.clone(), shutdown.clone())))
        .collect();
    handles.push(tokio::spawn(housekeeping(pool, shutdown)));
    handles
}

async fn deliver(pool: PgPool, domains: Domains, mut shutdown: watch::Receiver<bool>) {
    let owner = Uuid::new_v4();
    let names: Vec<&str> = domains.iter().map(|domain| domain.name()).collect();
    while !*shutdown.borrow() {
        if !names.is_empty() {
            match claim::claim(&pool, owner, &names, LEASE_SECONDS).await {
                Ok(Some(job)) => {
                    let domain = domains.iter().find(|domain| domain.name() == job.domain);
                    if let Some(domain) = domain {
                        let jitter = rand::random::<u64>();
                        if run::run(&pool, domain.as_ref(), &job, jitter)
                            .await
                            .is_err()
                        {
                            eprintln!("CRM outbox job could not be settled.");
                        }
                    }
                    continue;
                }
                Ok(None) => {}
                Err(_) => eprintln!("CRM outbox claim failed."),
            }
        }
        if pause(&mut shutdown, POLL).await {
            break;
        }
    }
}

/// Settles expired leases often and purges finished jobs hourly.
async fn housekeeping(pool: PgPool, mut shutdown: watch::Receiver<bool>) {
    let mut last_cleanup: Option<tokio::time::Instant> = None;
    while !*shutdown.borrow() {
        if claim::settle_expired(&pool).await.is_err() {
            eprintln!("CRM outbox lease sweep failed.");
        }
        if last_cleanup.is_none_or(|at| at.elapsed() >= CLEANUP_EVERY) {
            if cleanup::purge(&pool).await.is_err() {
                eprintln!("CRM outbox retention cleanup failed.");
            }
            last_cleanup = Some(tokio::time::Instant::now());
        }
        if pause(&mut shutdown, Duration::from_secs(5)).await {
            break;
        }
    }
}

/// Sleeps for `period`; `true` when shutdown was requested meanwhile.
pub async fn pause(shutdown: &mut watch::Receiver<bool>, period: Duration) -> bool {
    tokio::select! {
        _ = tokio::time::sleep(period) => *shutdown.borrow(),
        changed = shutdown.changed() => changed.is_err() || *shutdown.borrow(),
    }
}
