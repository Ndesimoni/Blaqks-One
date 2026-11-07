use super::{delivery::Delivery, jobs};
use sqlx::PgPool;
use std::{sync::Arc, time::Duration};
use tokio::{sync::watch, task::JoinHandle};
use uuid::Uuid;

pub const CONCURRENCY: usize = 2;
pub const LEASE_SECONDS: i64 = 30;
const POLL: Duration = Duration::from_millis(500);

/// Spawns bounded delivery loops. Each owns a random lease identity, so `SKIP LOCKED` keeps
/// two workers apart; shutdown stops new claims and lets the in-flight job finish.
pub fn spawn(
    pool: PgPool,
    delivery: Arc<dyn Delivery>,
    shutdown: watch::Receiver<bool>,
) -> Vec<JoinHandle<()>> {
    (0..CONCURRENCY)
        .map(|_| {
            let pool = pool.clone();
            let delivery = delivery.clone();
            let mut shutdown = shutdown.clone();
            let owner = Uuid::new_v4();
            tokio::spawn(async move {
                loop {
                    if *shutdown.borrow() {
                        break;
                    }
                    match jobs::claim(&pool, owner, LEASE_SECONDS).await {
                        Ok(Some(job)) => {
                            let jitter = rand::random::<u64>();
                            if jobs::run(&pool, delivery.as_ref(), job, jitter)
                                .await
                                .is_err()
                            {
                                eprintln!("CRM sign-up delivery failed.");
                            }
                        }
                        Ok(None) => {}
                        Err(_) => eprintln!("CRM sign-up delivery claim failed."),
                    }
                    tokio::select! {
                        _ = tokio::time::sleep(POLL) => {}
                        changed = shutdown.changed() => {
                            if changed.is_err() || *shutdown.borrow() { break; }
                        }
                    }
                }
            })
        })
        .collect()
}
