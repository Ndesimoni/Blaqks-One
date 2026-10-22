//! Finance routes under `/api/crm/workspaces/{workspace}/finance` (finance-design §6),
//! merged into the application router with one line in `routes.rs`.
use super::{agreements, deals, decisions, expenses, history, overview, payments, settings};
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
        .route(
            &handover("accept"),
            post(deals::handover_routes::accept).layer(body()),
        )
        .route(&handover("decline"), post(deals::handover_routes::decline))
        .route(&handover("cancel"), post(deals::handover_routes::cancel))
        .route(
            &handover("approve"),
            post(deals::handover_routes::approve).layer(body()),
        )
        .merge(handover_review_routes())
        .route(
            &format!("{BASE}/assignees"),
            get(deals::assignees::assignees),
        )
}

/// H2 (agreements design §17): approving a waiting acceptance, the preview, the
/// sidebar's waiting counts and the approver list.
fn handover_review_routes() -> Router<AppState> {
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
            &format!("{BASE}/handovers/waiting"),
            get(deals::handover_waiting::waiting),
        )
        .route(
            &format!("{BASE}/approvers"),
            get(deals::assignees::approvers),
        )
}

/// Payments and expenses: create, edit, decide and history (finance-design §6.2).
fn entry_routes() -> Router<AppState> {
    let body = || DefaultBodyLimit::max(32 * 1024);
    let path = |suffix: &str| format!("{BASE}/{suffix}");
    Router::new()
        .route(
            &path("payments"),
            post(payments::create::create).layer(body()),
        )
        .route(
            &path("payments/{id}"),
            axum::routing::patch(payments::update::update).layer(body()),
        )
        .route(
            &path("payments/{id}/approve"),
            post(decisions::approve_payment).layer(body()),
        )
        .route(
            &path("payments/{id}/reject"),
            post(decisions::reject_payment).layer(body()),
        )
        .route(
            &path("payments/{id}/void"),
            post(decisions::void_payment).layer(body()),
        )
        .route(&path("payments/{id}/history"), get(history::payment))
        .route(
            &path("expenses"),
            post(expenses::create::create).layer(body()),
        )
        .route(
            &path("expenses/{id}"),
            axum::routing::patch(expenses::update::update).layer(body()),
        )
        .route(
            &path("expenses/{id}/approve"),
            post(decisions::approve_expense).layer(body()),
        )
        .route(
            &path("expenses/{id}/reject"),
            post(decisions::reject_expense).layer(body()),
        )
        .route(
            &path("expenses/{id}/void"),
            post(decisions::void_expense).layer(body()),
        )
        .route(&path("expenses/{id}/history"), get(history::expense))
        .route(&path("deals/{id}/history"), get(history::deal))
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
        .merge(entry_routes())
}
