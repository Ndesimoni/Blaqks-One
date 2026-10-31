//! Performance routes under `/api/crm/workspaces/{workspace}/performance`, merged into the
//! application router with one line in `routes.rs`.
use super::targets;
use crate::state::AppState;
use axum::{extract::DefaultBodyLimit, routing::get, Router};

const BASE: &str = "/api/crm/workspaces/{workspace}/performance";

pub fn router() -> Router<AppState> {
    Router::new().route(
        &format!("{BASE}/targets"),
        get(targets::list)
            .put(targets::save)
            .layer(DefaultBodyLimit::max(16 * 1024)),
    )
}
