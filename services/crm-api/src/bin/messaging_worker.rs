//! The messaging worker process (docs/messaging-design.md §2): runs the outbox delivery
//! loops, lease sweeps and retention purges, and hands verified webhook events to the
//! Inbox. The API process never claims jobs. Stop it with Ctrl-C
//! or SIGTERM; in-flight sends finish first.
use kws_crm_api::{
    config::Config,
    inbox::{intake::InboxSink, send::domain::InboxSender},
    integrations::{
        mail_sync, revocation,
        webhooks::inbound::{self, Sink},
    },
    media::sweep as media_sweep,
    outbox, routes, shutdown,
};
use sqlx::postgres::PgPoolOptions;
use std::{sync::Arc, time::Duration};

const ALL: &str = "outbox,revocations,inbound,mailsync,mediasweep";

/// A loop interval from the environment, 1–3600 seconds.
fn seconds(name: &str, default: u64) -> Duration {
    let value = std::env::var(name)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|seconds| (1..=3600).contains(seconds))
        .unwrap_or(default);
    Duration::from_secs(value)
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    if let Err(message) = run().await {
        eprintln!("{message}");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), String> {
    routes::register_domain_errors();
    let config = Config::from_env()?;
    let key = config
        .messaging
        .clone()
        .ok_or("CRM_MESSAGING_KEY is required for the messaging worker.")?;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&config.database_url)
        .await
        .map_err(|_| "CRM database connection failed.")?;
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|_| "CRM schema migration failed. Check database access and migration history.")?;
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);
    // CRM_WORKER_LOOPS picks loops (default all); the API suites run outbox and
    // revocations only, so webhook staging stays visible to their assertions.
    let loops = std::env::var("CRM_WORKER_LOOPS").unwrap_or_else(|_| ALL.into());
    let wants = |name: &str| loops.split(',').any(|item| item.trim() == name);
    // A misspelt loop name would silently switch that loop off (review E1b L3).
    if let Some(unknown) = loops
        .split(',')
        .find(|item| !ALL.split(',').any(|name| name == item.trim()))
    {
        return Err(format!(
            "CRM_WORKER_LOOPS has an unknown loop: {}.",
            unknown.trim()
        ));
    }
    println!("CRM messaging worker loops: {loops}.");
    // Google mailboxes (when configured) and SendGrid accounts send through one domain.
    let domains: Vec<Arc<dyn outbox::model::Domain>> = vec![Arc::new(InboxSender {
        pool: pool.clone(),
        key: key.clone(),
        google: config.google.clone(),
        sendgrid: config.sendgrid.clone(),
    })];
    let mut handles = Vec::new();
    if wants("outbox") {
        let domains: outbox::worker::Domains = Arc::new(domains);
        handles.extend(outbox::worker::spawn(
            pool.clone(),
            domains,
            shutdown_rx.clone(),
        ));
    }
    if let (true, Some(google)) = (wants("revocations"), config.google.clone()) {
        handles.push(revocation::spawn(
            pool.clone(),
            key.clone(),
            google,
            shutdown_rx.clone(),
        ));
    }
    if let (true, Some(google)) = (wants("mailsync"), config.google.clone()) {
        let every = seconds("CRM_MAIL_SYNC_SECONDS", 30);
        let sync = mail_sync::Sync {
            pool: pool.clone(),
            key: key.clone(),
            google,
            sink: Arc::new(InboxSink { pool: pool.clone() }),
        };
        handles.push(mail_sync::spawn(sync, every, shutdown_rx.clone()));
    }
    if wants("inbound") {
        let sink: Arc<dyn Sink> = Arc::new(InboxSink { pool: pool.clone() });
        handles.extend(inbound::spawn(
            pool.clone(),
            key.clone(),
            Some(sink),
            shutdown_rx.clone(),
        ));
    }
    if let (true, Some(media)) = (wants("mediasweep"), config.media.clone()) {
        let every = seconds("CRM_MEDIA_SWEEP_SECONDS", 600);
        handles.push(media_sweep::spawn(
            pool.clone(),
            media,
            every,
            shutdown_rx.clone(),
        ));
    }
    println!("CRM messaging worker running.");
    shutdown::signal().await;
    let _ = shutdown_tx.send(true);
    for handle in handles {
        let _ = handle.await;
    }
    println!("CRM messaging worker stopped.");
    Ok(())
}
