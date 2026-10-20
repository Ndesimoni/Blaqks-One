//! The messaging worker process (docs/messaging-design.md §2): runs the outbox delivery
//! loops, lease sweeps and retention purges, and processes verified webhook events once
//! the Inbox (X3) provides a sink. The API process never claims jobs. Stop it with Ctrl-C
//! or SIGTERM; in-flight sends finish first.
use kws_crm_api::{config::Config, integrations::webhooks::inbound, outbox, routes, shutdown};
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;

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
    // No sending domain or inbound sink exists until the Inbox (X3).
    let domains: outbox::worker::Domains = Arc::new(Vec::new());
    let mut handles = outbox::worker::spawn(pool.clone(), domains, shutdown_rx.clone());
    handles.extend(inbound::spawn(pool, key, None, shutdown_rx));
    println!("CRM messaging worker running.");
    shutdown::signal().await;
    let _ = shutdown_tx.send(true);
    for handle in handles {
        let _ = handle.await;
    }
    println!("CRM messaging worker stopped.");
    Ok(())
}
