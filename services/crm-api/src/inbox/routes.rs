//! Inbox routes under `/api/crm/workspaces/{workspace}/inbox`, merged by `routes.rs`.
use super::{commands, list, notes, read};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};

const BASE: &str = "/api/crm/workspaces/{workspace}/inbox/conversations";

pub fn router() -> Router<AppState> {
    let body = || DefaultBodyLimit::max(32 * 1024);
    let item = format!("{BASE}/{{id}}");
    Router::new()
        .route(BASE, get(list::list))
        .route(&item, get(read::read).patch(commands::update).layer(body()))
        .route(
            &format!("{item}/read"),
            post(notes::mark_read).layer(body()),
        )
        .route(
            &format!("{item}/notes"),
            post(notes::add_note).layer(body()),
        )
}
