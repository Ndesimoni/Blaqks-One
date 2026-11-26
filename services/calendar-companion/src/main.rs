mod api;
mod google;
mod store;
mod sync;
#[cfg(test)]
mod tests;

use std::{path::PathBuf, sync::Arc, time::Duration};
use tokio::sync::Mutex;

pub type ApiError = (axum::http::StatusCode, axum::Json<serde_json::Value>);
pub fn error(status: axum::http::StatusCode, message: &str) -> ApiError {
    (status, axum::Json(serde_json::json!({"message": message})))
}

#[derive(Clone)]
pub struct App {
    pub origin: String,
    pub client_id: String,
    pub client_secret: String,
    pub vault: store::Vault,
    pub store: Arc<Mutex<store::Store>>,
    pub google: google::Google,
    pub sync_gate: Arc<Mutex<()>>,
}
impl App {
    pub fn configured(&self) -> bool {
        !self.client_id.is_empty() && !self.client_secret.is_empty() && self.vault.key.is_some()
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let origin = std::env::var("APP_ORIGIN").unwrap_or("http://localhost:5173".into());
    let parsed = url::Url::parse(&origin)?;
    // This companion belongs to the browser-local CRM, before multi-user authentication.
    if !matches!(parsed.host_str(), Some("localhost" | "127.0.0.1"))
        || parsed.path() != "/"
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err("APP_ORIGIN must be a local CRM origin, e.g. http://localhost:5173".into());
    }
    let key = std::env::var("CALENDAR_ENCRYPTION_KEY").unwrap_or_default();
    let vault = store::Vault::new(
        PathBuf::from(std::env::var("CALENDAR_STORE").unwrap_or("data/calendar.enc".into())),
        &key,
    )?;
    let initial = vault.load()?;
    let app = App {
        origin: origin.trim_end_matches('/').into(),
        client_id: std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
        client_secret: std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default(),
        vault,
        store: Arc::new(Mutex::new(initial)),
        google: google::Google::new(),
        sync_gate: Arc::new(Mutex::new(())),
    };
    let worker = app.clone();
    tokio::spawn(async move {
        loop {
            if let Err(message) = sync::tick(&worker).await {
                eprintln!("Calendar worker: {message}");
            }
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    });
    let port: u16 = std::env::var("CALENDAR_PORT")
        .unwrap_or("8787".into())
        .parse()?;
    let listener = tokio::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, port)).await?;
    println!("Calendar backend listening on 127.0.0.1:{port}");
    axum::serve(listener, api::router(app))
        .with_graceful_shutdown(async {
            tokio::signal::ctrl_c().await.ok();
        })
        .await?;
    Ok(())
}
