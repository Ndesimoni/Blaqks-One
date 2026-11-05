//! Help request routes, merged into the application router by `routes.rs`.
use super::{member, member_thread, platform, platform_thread};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};

const BODY: usize = 16 * 1024;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/crm/workspaces/{workspace}/help",
            get(member::list)
                .post(member::create)
                .layer(DefaultBodyLimit::max(BODY)),
        )
        .route(
            "/api/crm/workspaces/{workspace}/help/summary",
            get(member::summary),
        )
        .route(
            "/api/crm/workspaces/{workspace}/help/{id}",
            get(member_thread::read),
        )
        .route(
            "/api/crm/workspaces/{workspace}/help/{id}/messages",
            post(member_thread::reply).layer(DefaultBodyLimit::max(BODY)),
        )
        .route("/api/crm/platform/help", get(platform::list))
        .route("/api/crm/platform/help/summary", get(platform::summary))
        .route("/api/crm/platform/help/people", get(platform::people))
        .route(
            "/api/crm/platform/help/{id}",
            get(platform_thread::read)
                .patch(platform_thread::update)
                .layer(DefaultBodyLimit::max(BODY)),
        )
        .route(
            "/api/crm/platform/help/{id}/messages",
            post(platform_thread::reply).layer(DefaultBodyLimit::max(BODY)),
        )
}
