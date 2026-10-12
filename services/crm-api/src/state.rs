use crate::config::Config;
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Arc<Config>,
    pub dummy_hash: Arc<String>,
    pub password_workers: Arc<tokio::sync::Semaphore>,
}
