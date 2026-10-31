use super::account_type::limit;
use crate::state::AppState;
use axum::{extract::DefaultBodyLimit, routing::put, Router};

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/api/crm/workspaces/{workspace}/company/seat-limit",
        put(limit::update).layer(DefaultBodyLimit::max(16 * 1024)),
    )
}
