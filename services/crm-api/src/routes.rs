use crate::{
    assignments,
    auth::handlers as auth,
    error::{ApiError, ApiResult},
    imports,
    records::handlers as records,
    state::AppState,
    team, workspaces,
};
use axum::{
    extract::{DefaultBodyLimit, Request, State},
    http::{header, HeaderValue, StatusCode},
    middleware::{self, Next},
    response::Response,
    routing::{get, post, put},
    Json, Router,
};
use serde_json::{json, Value};

async fn health(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await?;
    Ok(Json(json!({"status": "ok", "service": "kws-crm-api"})))
}

async fn response_policy(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    response
}

async fn unknown_route() -> ApiError {
    ApiError(StatusCode::NOT_FOUND, "API route not found.", "not_found")
}

async fn unsupported_method() -> ApiError {
    ApiError(
        StatusCode::METHOD_NOT_ALLOWED,
        "HTTP method not allowed.",
        "method_not_allowed",
    )
}

pub fn app(state: AppState) -> Router {
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
            "/api/crm/workspaces/{workspace}/activity",
            get(workspaces::handlers::activity),
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
        .fallback(unknown_route)
        .method_not_allowed_fallback(unsupported_method)
        .layer(DefaultBodyLimit::max(12 * 1024 * 1024 + 1024))
        .layer(middleware::from_fn(response_policy))
        .with_state(state)
}
