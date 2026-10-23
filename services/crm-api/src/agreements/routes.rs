//! Agreement routes under `/api/crm/workspaces/{workspace}/agreements`, merged
//! into the application router by `routes.rs`.
use super::{
    amendment, amendment_answer, archive, certificate, closure, payment_read, payment_routes,
};
use super::{detail, handlers, lifecycle, recipients, respond, revise, waiting};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};

const BASE: &str = "/api/crm/workspaces/{workspace}/agreements";

pub fn router() -> Router<AppState> {
    let body = || DefaultBodyLimit::max(32 * 1024);
    let item = format!("{BASE}/{{id}}");
    let action = |name: &str| format!("{BASE}/{{id}}/{name}");
    Router::new()
        .route(
            BASE,
            get(handlers::list).post(handlers::create).layer(body()),
        )
        .route(
            &format!("{BASE}/recipients"),
            post(recipients::find).layer(body()),
        )
        .route(&format!("{BASE}/waiting"), get(waiting::count))
        .route(&item, get(detail::read).patch(revise::edit).layer(body()))
        .route(&action("send"), post(lifecycle::send).layer(body()))
        .route(&action("accept"), post(respond::accept).layer(body()))
        .route(&action("decline"), post(respond::decline).layer(body()))
        .route(&action("revoke"), post(lifecycle::revoke).layer(body()))
        .route(&action("counter"), post(revise::counter).layer(body()))
        .route(&action("amend"), post(amendment::propose).layer(body()))
        .route(
            &action("amend/accept"),
            post(amendment_answer::accept).layer(body()),
        )
        .route(
            &action("amend/decline"),
            post(amendment_answer::decline).layer(body()),
        )
        .route(&action("complete"), post(closure::complete).layer(body()))
        .route(&action("cancel"), post(closure::cancel).layer(body()))
        .route(&action("archive"), post(archive::archive).layer(body()))
        .route(&action("certificate"), get(certificate::read))
        .route(
            &action("payments"),
            get(payment_read::read)
                .post(payment_routes::paid)
                .layer(body()),
        )
        .route(
            &action("payments/{payment}/confirm"),
            post(payment_routes::confirm).layer(body()),
        )
        .route(
            &action("payments/{payment}/withdraw"),
            post(payment_routes::withdraw).layer(body()),
        )
}
