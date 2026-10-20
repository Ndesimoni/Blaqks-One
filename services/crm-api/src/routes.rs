#[path = "routes_support.rs"]
mod support;

use crate::{
    activity, agreements, assignments,
    auth::handlers as auth,
    chat,
    error::{self, CodeMapper},
    finance, imports, inbox, integrations, performance,
    records::handlers as records,
    signup,
    state::AppState,
    team, workspaces,
};
use axum::{
    extract::DefaultBodyLimit,
    middleware,
    routing::{get, post, put},
    Router,
};
use support::{health, response_policy, unknown_route, unsupported_method};

const DOMAIN_CODES: &[CodeMapper] = &[
    finance::errors::mapped,
    performance::errors::mapped,
    agreements::errors::mapped,
];

/// Registers every domain's database error mapping. `app` calls it; command-line paths
/// that convert database errors call it before running.
pub fn register_domain_errors() {
    error::register_codes(DOMAIN_CODES);
}

pub fn app(state: AppState) -> Router {
    register_domain_errors();
    Router::new()
        .route("/api/crm/health", get(health))
        .route(
            "/api/crm/auth/login",
            post(auth::login).layer(DefaultBodyLimit::max(16 * 1024)),
        )
        .route("/api/crm/auth/session", get(auth::current))
        .route("/api/crm/auth/logout", post(auth::logout))
        .route(
            "/api/crm/auth/invitations/inspect",
            post(team::invitations::inspect::inspect).layer(DefaultBodyLimit::max(16 * 1024)),
        )
        .route(
            "/api/crm/auth/invitations/accept",
            post(team::invitations::activation::accept).layer(DefaultBodyLimit::max(16 * 1024)),
        )
        .route("/api/crm/workspaces", get(workspaces::handlers::directory))
        .route(
            "/api/crm/workspaces/{workspace}/team/{id}/invitations",
            post(team::invitations::renewal::renew).layer(DefaultBodyLimit::max(16 * 1024)),
        )
        .route(
            "/api/crm/workspaces/{workspace}/team",
            get(team::members::directory::list),
        )
        .route(
            "/api/crm/workspaces/{workspace}/team/invitations",
            post(team::invitations::create::create).layer(DefaultBodyLimit::max(16 * 1024)),
        )
        .route(
            "/api/crm/workspaces/{workspace}/team/{id}",
            axum::routing::patch(team::members::update::update)
                .delete(team::archive::handlers::archive)
                .layer(DefaultBodyLimit::max(16 * 1024)),
        )
        .route(
            "/api/crm/workspaces/{workspace}/team/{id}/archive-preview",
            get(team::archive::handlers::preview),
        )
        .route(
            "/api/crm/workspaces/{workspace}/imports/preview",
            post(imports::preview::preview),
        )
        .route(
            "/api/crm/workspaces/{workspace}/imports/commit",
            post(imports::commit::commit),
        )
        .route(
            "/api/crm/workspaces/{workspace}/records",
            get(records::list),
        )
        .route(
            "/api/crm/workspaces/{workspace}/records/{collection}",
            post(records::create),
        )
        .route(
            "/api/crm/workspaces/{workspace}/records/{collection}/{id}",
            axum::routing::patch(records::update).delete(records::delete),
        )
        .route(
            "/api/crm/workspaces/{workspace}/records/{collection}/{id}/assignee",
            put(assignments::assign::assign).layer(DefaultBodyLimit::max(16 * 1024)),
        )
        .route(
            "/api/crm/workspaces/{workspace}/records/{collection}/{id}/assignments",
            get(assignments::log::history),
        )
        .route(
            "/api/crm/workspaces/{workspace}/assignees",
            get(assignments::assignees::assignees),
        )
        .route(
            "/api/crm/workspaces/{workspace}/assignments/bulk",
            post(assignments::bulk::bulk)
                .layer(DefaultBodyLimit::max(assignments::requests::MAX_BULK_BYTES)),
        )
        .merge(crate::auth::account::router())
        .merge(agreements::routes::router())
        .merge(integrations::routes::router())
        .merge(integrations::webhooks::router())
        .merge(inbox::routes::router())
        .merge(chat::routes::router())
        .merge(finance::routes::router())
        .merge(performance::routes::router())
        .merge(activity::routes::router())
        .merge(team::routes::router())
        .merge(workspaces::routes::router())
        .merge(signup::routes::router(state.config.signup))
        .fallback(unknown_route)
        .method_not_allowed_fallback(unsupported_method)
        .layer(DefaultBodyLimit::max(12 * 1024 * 1024 + 1024))
        .layer(middleware::from_fn(response_policy))
        .with_state(state)
}
