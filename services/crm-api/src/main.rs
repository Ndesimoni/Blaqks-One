use kws_crm_api::{
    auth::{password, session},
    bootstrap,
    config::Config,
    routes,
    sample::{self, guard, marker, options::Options},
    shutdown, signup,
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
    // Before any command: domain database errors keep their own messages.
    routes::register_domain_errors();
    let config = Config::from_env()?;
    let command = std::env::args().nth(1);
    let sample_options = match command.as_deref() {
        Some(name @ ("seed-sample" | "clear-sample")) => {
            let args: Vec<String> = std::env::args().skip(2).collect();
            let options = Options::parse(name, &args)?;
            // Before connecting: never reach a database outside local development.
            guard::ensure_local(!config.secure_cookie, &config.database_url)?;
            Some(options)
        }
        _ => None,
    };
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await
        .map_err(|_| "CRM database connection failed.")?;
    if config.signup == kws_crm_api::config::SignupMode::Local {
        marker::ensure(&pool).await?;
    }
    if sample_options.is_some() {
        // Before migrations or writes: the database itself must be marked as local.
        marker::ensure(&pool).await?;
    }
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|_| "CRM schema migration failed. Check database access and migration history.")?;
    if config.signup == kws_crm_api::config::SignupMode::Local {
        signup::cleanup::run(&pool)
            .await
            .map_err(|_| "CRM sign-up retention cleanup failed.")?;
        signup::cleanup::schedule(pool.clone());
    }
    if let Some(options) = sample_options {
        let database = guard::describe(&config.database_url);
        println!("{}", sample::run(&pool, options, &database).await?);
        return Ok(());
    }
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
        return Err("Supported commands: create-user, migrate, seed-sample, clear-sample.".into());
    }
    let address = config.address;
    let signup_worker = config.signup_worker;
    let local_signup = config.signup == kws_crm_api::config::SignupMode::Local;
    let dummy_hash = password::hash(session::random_token())
        .await
        .map_err(|_| "CRM authentication initialization failed.")?;
    let signup = Arc::new(signup::Services::new(
        config.signup,
        signup::client::ClientKeys::new(
            &config.trusted_proxies,
            &config.client_header,
            &config.client_secret,
        )?,
        match &config.turnstile {
            Some(turnstile) => signup::bot::turnstile(turnstile)
                .map_err(|error| format!("Turnstile configuration failed: {error}"))?,
            None => Arc::new(signup::bot::LocalBypass::new(config.signup)),
        },
    ));
    let state = AppState {
        pool: pool.clone(),
        config: Arc::new(config),
        dummy_hash: Arc::new(dummy_hash),
        password_workers: Arc::new(tokio::sync::Semaphore::new(4)),
        signup: signup.clone(),
    };
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);
    let workers = if local_signup && signup_worker {
        signup::worker::spawn(pool, signup.delivery.clone(), shutdown_rx)
    } else {
        Vec::new()
    };
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .map_err(|_| "CRM listener could not bind. Check CRM_BIND_ADDRESS.")?;
    println!("CRM API listening on {address}");
    let signal_tx = shutdown_tx.clone();
    let served = axum::serve(
        listener,
        routes::app(state).into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(async move {
        shutdown::signal().await;
        let _ = signal_tx.send(true);
    })
    .await;
    let _ = shutdown_tx.send(true);
    for worker in workers {
        let _ = worker.await;
    }
    served.map_err(|_| "CRM HTTP service failed.")?;
    Ok(())
}
