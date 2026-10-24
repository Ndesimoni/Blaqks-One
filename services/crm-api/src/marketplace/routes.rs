//! Marketplace routes (packets MK1a and MK1b), merged into the application router by
//! `routes.rs`. Member routes live under the caller's own company; the platform routes use the
//! Super Admin's workspace in the path and answer only a Super Admin session.
use super::{
    accept, application, company, decision, decisions, join, leave, me, photo, profile_read,
    terms_read,
};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post, put},
    Router,
};

const BASE: &str = "/api/crm/workspaces/{workspace}/marketplace";

pub fn router() -> Router<AppState> {
    let body = || DefaultBodyLimit::max(16 * 1024);
    Router::new()
        .route(&format!("{BASE}/status"), get(application::status))
        .route(
            &format!("{BASE}/application"),
            post(application::apply).layer(body()),
        )
        .route(
            &format!("{BASE}/company"),
            put(company::switch).layer(body()),
        )
        .route(
            &format!("{BASE}/decision"),
            post(decision::decide).layer(body()),
        )
        .route(
            "/api/crm/workspaces/super-admin-workspace/marketplace/applications",
            get(decisions::list),
        )
        .route(&format!("{BASE}/terms/{{version}}"), get(terms_read::read))
        .route(&format!("{BASE}/join"), post(join::join).layer(body()))
        .route(
            &format!("{BASE}/me"),
            axum::routing::patch(me::edit).layer(body()),
        )
        .route(
            &format!("{BASE}/terms/accept"),
            post(accept::accept).layer(body()),
        )
        .route(
            &format!("{BASE}/me/photo"),
            put(photo::put).delete(photo::remove).layer(body()),
        )
        .route(&format!("{BASE}/leave"), post(leave::leave).layer(body()))
        .route(
            &format!("{BASE}/profiles/{{member}}"),
            get(profile_read::read),
        )
        .route(
            &format!("{BASE}/profiles/{{member}}/photo"),
            get(profile_read::serve_photo),
        )
}
