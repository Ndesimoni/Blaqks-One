//! Channel routes under `/api/crm/workspaces/{workspace}/channels`, merged into the
//! application router by `routes.rs`. Provider webhooks (X2) will use their own public
//! prefix, never this one.
use super::{commands, handlers};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{delete, get, post},
    Router,
};

const BASE: &str = "/api/crm/workspaces/{workspace}/channels";

pub fn router() -> Router<AppState> {
    let body = || DefaultBodyLimit::max(16 * 1024);
    let item = format!("{BASE}/{{id}}");
    Router::new()
        .route(
            BASE,
            get(handlers::list).post(handlers::connect).layer(body()),
        )
        .route(&item, delete(commands::disconnect).layer(body()))
        .route(
            &format!("{item}/reconnect"),
            post(commands::reconnect).layer(body()),
        )
}
