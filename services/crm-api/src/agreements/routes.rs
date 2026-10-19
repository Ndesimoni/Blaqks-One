//! Agreement routes under `/api/crm/workspaces/{workspace}/agreements`, merged
//! into the application router by `routes.rs`.
use super::{handlers, lifecycle, respond, revise};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};

const BASE: &str = "/api/crm/workspaces/{workspace}/agreements";

pub fn router() -> Router<AppState> {
    let body = || DefaultBodyLimit::max(32 * 1024);
    let item = format!("{BASE}/{{id}}");
    let action = |name: &str| format!("{BASE}/{{id}}/{name}");
    Router::new()
        .route(
            BASE,
            get(handlers::list).post(handlers::create).layer(body()),
        )
        .route(&item, get(handlers::read).patch(revise::edit).layer(body()))
        .route(&action("send"), post(lifecycle::send).layer(body()))
        .route(&action("accept"), post(respond::accept).layer(body()))
        .route(&action("decline"), post(respond::decline).layer(body()))
        .route(&action("revoke"), post(lifecycle::revoke).layer(body()))
        .route(&action("counter"), post(revise::counter).layer(body()))
}
