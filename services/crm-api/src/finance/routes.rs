//! Finance routes under `/api/crm/workspaces/{workspace}/finance` (finance-design §6),
//! merged into the application router with one line in `routes.rs`.
use super::{agreements, overview, settings};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{delete, get, put},
    Router,
};

const BASE: &str = "/api/crm/workspaces/{workspace}/finance";

pub fn router() -> Router<AppState> {
    let body = || DefaultBodyLimit::max(16 * 1024);
    Router::new()
        .route(BASE, get(overview::overview))
        .route(
            &format!("{BASE}/settings"),
            put(settings::save).layer(body()),
        )
        .route(
            &format!("{BASE}/agreements"),
            get(agreements::list).post(agreements::create).layer(body()),
        )
        .route(
            &format!("{BASE}/agreements/{{id}}"),
            delete(agreements::delete),
        )
}
