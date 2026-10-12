use kws_crm_api::{
    auth::{password, session},
    bootstrap,
    config::Config,
    routes,
    state::AppState,
};
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
    let config = Config::from_env()?;
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await
        .map_err(|_| "CRM database connection failed.")?;
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|_| "CRM schema migration failed. Check database access and migration history.")?;
    let command = std::env::args().nth(1);
    if command.as_deref() == Some("migrate") {
        println!("CRM database migrations applied.");
        return Ok(());
    }
    if command.as_deref() == Some("create-user") {
        let id = bootstrap::create_user(&pool)
            .await
            .map_err(|error| error.1.to_owned())?;
        println!("{}", serde_json::json!({"id": id, "created": true}));
        return Ok(());
    }
    if command.is_some() {
        return Err("Supported commands: create-user, migrate.".into());
    }
    let address = config.address;
    let dummy_hash = password::hash(session::random_token())
        .await
        .map_err(|_| "CRM authentication initialization failed.")?;
    let state = AppState {
        pool,
        config: Arc::new(config),
        dummy_hash: Arc::new(dummy_hash),
        password_workers: Arc::new(tokio::sync::Semaphore::new(4)),
    };
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .map_err(|_| "CRM listener could not bind. Check CRM_BIND_ADDRESS.")?;
    println!("CRM API listening on {address}");
    axum::serve(listener, routes::app(state))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
        .map_err(|_| "CRM HTTP service failed.")?;
    Ok(())
}
