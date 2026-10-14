//! Finance routes under `/api/crm/workspaces/{workspace}/finance` (finance-design §6),
//! merged into the application router with one line in `routes.rs`.
use super::{agreements, deals, overview, settings};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{delete, get, post, put},
    Router,
};

const BASE: &str = "/api/crm/workspaces/{workspace}/finance";

fn deal_routes() -> Router<AppState> {
    let body = || DefaultBodyLimit::max(32 * 1024);
    let deal = |suffix: &str| format!("{BASE}/deals/{{id}}{suffix}");
    let handover = |suffix: &str| format!("{BASE}/handovers/{{id}}/{suffix}");
    Router::new()
        .route(
            &format!("{BASE}/deals"),
            post(deals::create::create).layer(body()),
        )
        .route(
            &deal(""),
            axum::routing::patch(deals::update::update)
                .delete(deals::delete::delete)
                .layer(body()),
        )
        .route(&deal("/split"), put(deals::split::split).layer(body()))
        .route(&deal("/earn"), post(deals::earn::earn).layer(body()))
        .route(&deal("/earn-preview"), get(deals::earn_preview::preview))
        .route(&deal("/revise"), post(deals::revise::revise).layer(body()))
        .route(&deal("/unearn"), post(deals::unearn::unearn).layer(body()))
        .route(&deal("/assignee"), put(deals::assign::assign).layer(body()))
        .route(
            &deal("/handovers"),
            post(deals::handover::request).layer(body()),
        )
        .route(&handover("accept"), post(deals::handover_decide::accept))
        .route(&handover("decline"), post(deals::handover_decide::decline))
        .route(&handover("cancel"), post(deals::handover_decide::cancel))
        .route(
            &handover("approve"),
            post(deals::handover_decide::approve).layer(body()),
        )
        .route(
            &format!("{BASE}/assignees"),
            get(deals::assignees::assignees),
        )
}

pub fn router() -> Router<AppState> {
    let body = || DefaultBodyLimit::max(16 * 1024);
    Router::new()
        .route(BASE, get(overview::overview))
        .route(
            &format!("{BASE}/settings"),
            put(settings::save).layer(body()),
        )
        .route(
            &format!("{BASE}/agreements"),
            get(agreements::list).post(agreements::create).layer(body()),
        )
        .route(
            &format!("{BASE}/agreements/{{id}}"),
            delete(agreements::delete),
        )
        .merge(deal_routes())
}
