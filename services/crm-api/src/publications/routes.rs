use super::handlers;
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/crm/workspaces/{workspace}/website/listings",
            get(handlers::list).post(handlers::publish),
        )
        .route(
            "/api/crm/workspaces/{workspace}/website/listings/{id}/withdraw",
            post(handlers::withdraw),
        )
        .layer(DefaultBodyLimit::max(32 * 1024))
}
