//! Inbox routes under `/api/crm/workspaces/{workspace}/inbox`, merged by `routes.rs`.
use super::{blocks, commands, list, notes, read, rules_api, summary, triage};
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
        .route(
            "/api/crm/workspaces/{workspace}/inbox/summary",
            get(summary::summary),
        )
        .route(&item, get(read::read).patch(commands::update).layer(body()))
        .route(
            &format!("{item}/read"),
            post(notes::mark_read).layer(body()),
        )
        .route(
            &format!("{item}/notes"),
            post(notes::add_note).layer(body()),
        )
        .route(&format!("{item}/lead"), post(triage::lead).layer(body()))
        .route(&format!("{item}/link"), post(triage::link).layer(body()))
        .route(
            &format!("{item}/resolve"),
            post(triage::resolve).layer(body()),
        )
        .route(&format!("{item}/block"), post(blocks::block).layer(body()))
        .route(
            &format!("{item}/unblock"),
            post(blocks::unblock).layer(body()),
        )
        .route(
            "/api/crm/workspaces/{workspace}/inbox/rules",
            get(rules_api::get).put(rules_api::put).layer(body()),
        )
}
