//! `POST /api/crm/workspaces/{workspace}/media`, merged by `routes.rs`. Files are read
//! only through their owning module's routes.
use super::upload;
use crate::state::AppState;
use axum::{
    extract::{DefaultBodyLimit, Request},
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::post,
    Router,
};
use std::sync::OnceLock;
use tokio::sync::Semaphore;

/// Uploads handled at once. Each may hold about 50 MB while it is checked and stored, so
/// a burst waits its turn instead of exhausting memory (security review F1 L1).
const AT_ONCE: usize = 4;

async fn limited(request: Request, next: Next) -> Response {
    static SLOTS: OnceLock<Semaphore> = OnceLock::new();
    let slots = SLOTS.get_or_init(|| Semaphore::new(AT_ONCE));
    // Checked before the body is read, so a refused upload costs no memory.
    let Ok(_slot) = slots.try_acquire() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            "Uploads are busy. Try again shortly.",
        )
            .into_response();
    };
    next.run(request).await
}

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/api/crm/workspaces/{workspace}/media",
        post(upload::upload)
            .layer(DefaultBodyLimit::max(21 * 1024 * 1024))
            .layer(middleware::from_fn(limited)),
    )
}
