//! Activity routes, merged into the application router with one line in `routes.rs`.
use super::handlers;
use crate::state::AppState;
use axum::{routing::get, Router};

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/api/crm/workspaces/{workspace}/activity",
        get(handlers::list),
    )
}
