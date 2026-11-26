use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/public/v1/sites/{site}/enquiries",
            post(super::intake::submit).layer(DefaultBodyLimit::max(16 * 1024)),
        )
        .route(
            "/api/crm/workspaces/{workspace}/website/enquiries",
            get(super::views::list),
        )
}
