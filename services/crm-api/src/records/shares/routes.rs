//! R1 routes under `/api/crm/workspaces/{workspace}/shares`.
use super::{actions, candidates, create, read};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};

const BASE: &str = "/api/crm/workspaces/{workspace}/shares";

pub fn router() -> Router<AppState> {
    let body = || DefaultBodyLimit::max(16 * 1024);
    let item = format!("{BASE}/{{id}}");
    Router::new()
        .route(BASE, get(read::list).post(create::create).layer(body()))
        .route(&format!("{BASE}/waiting"), get(read::waiting))
        .route(&format!("{BASE}/candidates"), get(candidates::candidates))
        .route(&item, get(read::one))
        .route(
            &format!("{item}/accept"),
            post(actions::accept).layer(body()),
        )
        .route(
            &format!("{item}/decline"),
            post(actions::decline).layer(body()),
        )
        .route(
            &format!("{item}/withdraw"),
            post(actions::withdraw).layer(body()),
        )
        .route(&format!("{item}/stop"), post(actions::stop).layer(body()))
}
