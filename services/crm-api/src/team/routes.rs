use super::{account_type::limit, platform};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, put},
    Router,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/crm/platform/companies", get(platform::companies))
        .route(
            "/api/crm/workspaces/{workspace}/company/seat-limit",
            put(limit::update).layer(DefaultBodyLimit::max(16 * 1024)),
        )
}
