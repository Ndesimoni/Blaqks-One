//! R2a routes under `/api/crm/workspaces/{workspace}/agreements/listing-shares`.
use super::{actions, create, evidence, extend, files, preview, read};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};

const BASE: &str = "/api/crm/workspaces/{workspace}/agreements/listing-shares";

pub fn router() -> Router<AppState> {
    let body = || DefaultBodyLimit::max(16 * 1024);
    let item = format!("{BASE}/{{id}}");
    let action = |name: &str| format!("{item}/{name}");
    Router::new()
        .route(BASE, get(read::list).post(create::create).layer(body()))
        .route(
            &format!("{BASE}/preview"),
            post(preview::preview).layer(body()),
        )
        .route(&item, get(read::one))
        .route(&action("accept"), post(actions::accept).layer(body()))
        .route(&action("decline"), post(actions::decline).layer(body()))
        .route(&action("withdraw"), post(actions::withdraw).layer(body()))
        .route(&action("stop"), post(actions::stop).layer(body()))
        .route(&action("extend"), post(extend::extend).layer(body()))
        .route(&action("evidence"), get(evidence::evidence))
        .route(&action("files/{file}"), get(files::file))
}
