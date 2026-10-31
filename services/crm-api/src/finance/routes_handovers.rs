//! Hand-over review routes under `/api/crm/workspaces/{workspace}/finance` (agreements
//! design §17–§18), merged into the deal routes.
use super::deals;
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};

const BASE: &str = "/api/crm/workspaces/{workspace}/finance";

/// H2 (agreements design §17): approving a waiting acceptance, the preview, the
/// sidebar's waiting counts and the approver list.
pub fn routes() -> Router<AppState> {
    let body = || DefaultBodyLimit::max(32 * 1024);
    let handover = |suffix: &str| format!("{BASE}/handovers/{{id}}/{suffix}");
    Router::new()
        .route(
            &handover("approve-acceptance"),
            post(deals::handover_routes::approve_acceptance).layer(body()),
        )
        .route(
            &handover("reject-acceptance"),
            post(deals::handover_routes::reject_acceptance),
        )
        .route(&handover("preview"), get(deals::handover_preview::preview))
        .route(
            &handover("preview/files/{file}"),
            get(deals::handover_preview_files::file),
        )
        .route(
            &format!("{BASE}/handovers/waiting"),
            get(deals::handover_waiting::waiting),
        )
        .route(
            &format!("{BASE}/approvers"),
            get(deals::assignees::approvers),
        )
}
