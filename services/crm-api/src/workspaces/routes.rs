use super::company::handlers;
use crate::state::AppState;
use axum::{extract::DefaultBodyLimit, routing::get, Router};

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/api/crm/workspaces/{workspace}/company",
        get(handlers::read)
            .put(handlers::update)
            .layer(DefaultBodyLimit::max(16 * 1024)),
    )
}
