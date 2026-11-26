use crate::state::AppState;
use axum::{routing::get, Router};

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/public/v1/sites/resolve",
            get(super::handlers::resolve),
        )
        .route(
            "/api/public/v1/sites/{site}/{resource}",
            get(super::handlers::collection),
        )
        .route(
            "/api/public/v1/sites/{site}/{resource}/{id}",
            get(super::handlers::detail),
        )
}
