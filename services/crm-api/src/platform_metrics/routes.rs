//! Blaqks One's dashboard route, merged into the application router by `routes.rs`.
use super::handler;
use crate::state::AppState;
use axum::{routing::get, Router};

pub fn router() -> Router<AppState> {
    Router::new().route("/api/crm/platform/metrics", get(handler::metrics))
}
