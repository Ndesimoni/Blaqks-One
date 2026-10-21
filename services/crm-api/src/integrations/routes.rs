//! Channel routes under `/api/crm/workspaces/{workspace}/channels`, each member's own
//! mailbox under `/mailbox`, SendGrid sending addresses under `/email-addresses`, and
//! Google's sign-in redirect, merged into the application
//! router by `routes.rs`. Provider webhooks (X2) use their own public prefix.
use super::{addresses, commands, google, handlers, listing, mailbox};
use crate::{config::google_settings::CALLBACK_PATH, state::AppState};
use axum::{
    extract::DefaultBodyLimit,
    routing::{delete, get, patch, post},
    Router,
};

const BASE: &str = "/api/crm/workspaces/{workspace}/channels";
const MAILBOX: &str = "/api/crm/workspaces/{workspace}/mailbox";
const ADDRESSES: &str = "/api/crm/workspaces/{workspace}/email-addresses";

pub fn router() -> Router<AppState> {
    let body = || DefaultBodyLimit::max(16 * 1024);
    let item = format!("{BASE}/{{id}}");
    Router::new()
        .route(
            BASE,
            get(listing::list).post(handlers::connect).layer(body()),
        )
        .route(&item, delete(commands::disconnect).layer(body()))
        .route(
            &format!("{item}/reconnect"),
            post(commands::reconnect).layer(body()),
        )
        .route(
            MAILBOX,
            get(mailbox::mine).delete(mailbox::disconnect).layer(body()),
        )
        .route(
            &format!("{MAILBOX}/google/start"),
            post(mailbox::start).layer(body()),
        )
        .route(
            &format!("{MAILBOX}/google/finish"),
            post(mailbox::finish).layer(body()),
        )
        .route(
            ADDRESSES,
            get(addresses::list).post(addresses::create).layer(body()),
        )
        .route(
            &format!("{ADDRESSES}/{{id}}"),
            patch(addresses::rename)
                .delete(addresses::reserve)
                .layer(body()),
        )
        .route(CALLBACK_PATH, get(google::callback::callback))
}
