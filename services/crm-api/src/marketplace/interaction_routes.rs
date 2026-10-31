//! Request lifecycle and private broker conversation API.
use super::{conversation_routes as chat, conversation_start, lifecycle_routes, notices};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};
const BASE: &str = "/api/crm/workspaces/{workspace}/marketplace";
pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            &format!("{BASE}/requests/{{id}}/agreement"),
            post(super::agreement_routes::propose),
        )
        .route(
            &format!("{BASE}/requests/{{id}}/conversations"),
            get(chat::list).post(conversation_start::start),
        )
        .route(
            &format!("{BASE}/conversations/{{id}}/messages"),
            get(chat::read).post(chat::send),
        )
        .route(
            &format!("{BASE}/requests/{{id}}/select"),
            post(lifecycle_routes::select),
        )
        .route(
            &format!("{BASE}/requests/{{id}}/reopen"),
            post(lifecycle_routes::reopen),
        )
        .route(&format!("{BASE}/notifications"), get(notices::list))
        .route(&format!("{BASE}/activity"), get(super::activity::list))
        .layer(DefaultBodyLimit::max(12 * 1024))
}
