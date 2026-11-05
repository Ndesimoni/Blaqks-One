use super::{account_type::limit, platform, platform_controls, platform_members};
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
            "/api/crm/platform/companies/{workspace}/members",
            get(platform_members::list),
        )
        .route(
            "/api/crm/platform/companies/{workspace}/members/{id}/active",
            put(platform_controls::set_active).layer(DefaultBodyLimit::max(16 * 1024)),
        )
        .route(
            "/api/crm/workspaces/{workspace}/company/seat-limit",
            put(limit::update).layer(DefaultBodyLimit::max(16 * 1024)),
        )
}
