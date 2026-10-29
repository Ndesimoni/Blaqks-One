use super::{handlers, profiles};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post, put},
    Router,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/crm/workspaces/{workspace}/website/draft",
            get(super::draft_handlers::read).put(super::draft_handlers::save),
        )
        .route(
            "/api/crm/workspaces/{workspace}/website/publish",
            post(super::draft_handlers::publish),
        )
        .route(
            "/api/crm/platform/websites/general/draft",
            get(super::draft_handlers::platform_read).put(super::draft_handlers::platform_save),
        )
        .route(
            "/api/crm/platform/websites/general/publish",
            post(super::draft_handlers::platform_publish),
        )
        .route(
            "/api/crm/workspaces/{workspace}/website",
            get(handlers::config).put(handlers::update),
        )
        .route(
            "/api/crm/workspaces/{workspace}/website/profiles/{member}",
            get(profiles::get).put(profiles::update),
        )
        .route(
            "/api/crm/workspaces/{workspace}/website/profiles/{member}/grant",
            put(profiles::grant),
        )
        .route(
            "/api/crm/platform/websites/general",
            get(handlers::platform_config).put(handlers::platform),
        )
        .route(
            "/api/crm/platform/websites/companies/{workspace}/eligibility",
            put(handlers::eligibility),
        )
        .layer(DefaultBodyLimit::max(64 * 1024))
}
