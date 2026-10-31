//! Shared HTTP plumbing for the composition root: health, response headers and the
//! JSON fallbacks for unknown routes and methods.
use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Request, State},
    http::{header, HeaderValue, StatusCode},
    middleware::Next,
    response::Response,
    Json,
};
use serde_json::{json, Value};

pub(super) async fn health(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await?;
    Ok(Json(json!({"status": "ok", "service": "kws-crm-api"})))
}

pub(super) async fn response_policy(request: Request, next: Next) -> Response {
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

pub(super) async fn unknown_route() -> ApiError {
    ApiError(StatusCode::NOT_FOUND, "API route not found.", "not_found")
}

pub(super) async fn unsupported_method() -> ApiError {
    ApiError(
        StatusCode::METHOD_NOT_ALLOWED,
        "HTTP method not allowed.",
        "method_not_allowed",
    )
}
