//! Chat routes under `/api/crm/workspaces/{workspace}/chat`, merged by `routes.rs`.
use super::{change, counts, files, groups, leave, messages, read, rooms, send, start};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, patch, post},
    Router,
};

const BASE: &str = "/api/crm/workspaces/{workspace}/chat";

pub fn router() -> Router<AppState> {
    let body = || DefaultBodyLimit::max(32 * 1024);
    let room = format!("{BASE}/rooms/{{room}}");
    Router::new()
        .route(BASE, get(rooms::list))
        .route(&format!("{BASE}/summary"), get(counts::summary))
        .route(
            &format!("{BASE}/channels"),
            post(start::channel).layer(body()),
        )
        .route(&format!("{BASE}/direct"), post(start::direct).layer(body()))
        .route(
            &format!("{BASE}/groups"),
            post(groups::create).layer(body()),
        )
        .route(
            &format!("{room}/messages"),
            get(messages::list).post(send::send).layer(body()),
        )
        .route(&format!("{room}/read"), post(read::read).layer(body()))
        .route(&format!("{room}/leave"), post(leave::leave).layer(body()))
        .route(
            &format!("{room}/messages/{{message}}"),
            patch(change::edit).delete(change::delete).layer(body()),
        )
        .route(
            &format!("{room}/messages/{{message}}/files/{{file}}"),
            get(files::file),
        )
}
