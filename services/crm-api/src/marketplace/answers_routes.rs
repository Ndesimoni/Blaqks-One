use super::{answers_post, answers_preview, answers_read, answers_reject};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};
pub fn router() -> Router<AppState> {
    let base = "/api/crm/workspaces/{workspace}/marketplace/requests/{id}/offers";
    Router::new()
        .route(base, get(answers_read::read).post(answers_post::post))
        .route(&format!("{base}/preview"), post(answers_preview::preview))
        .route(
            &format!("{base}/{{answer}}/reject"),
            post(answers_reject::reject),
        )
        .layer(DefaultBodyLimit::max(16 * 1024))
}
