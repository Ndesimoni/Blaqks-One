//! Account self-service for every signed-in member (docs/account-self-service.md): view
//! the account, edit their own name and phone, change their password and review or
//! revoke their own sessions. Auth owns `crm_account_events` (migration 0018).
pub mod events;
mod live;
pub mod password;
pub mod profile;
pub mod sessions;

use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{delete, get, post},
    Router,
};

/// The self-service routes under `/api/crm/auth`, each with a 16 KiB body limit.
pub fn router() -> Router<AppState> {
    let limit = || DefaultBodyLimit::max(16 * 1024);
    Router::new()
        .route(
            "/api/crm/auth/account",
            get(profile::account).patch(profile::update).layer(limit()),
        )
        .route(
            "/api/crm/auth/account/password",
            post(password::change).layer(limit()),
        )
        .route("/api/crm/auth/sessions", get(sessions::list).layer(limit()))
        .route(
            "/api/crm/auth/sessions/revoke-others",
            post(sessions::revoke_others).layer(limit()),
        )
        .route(
            "/api/crm/auth/sessions/{id}",
            delete(sessions::revoke).layer(limit()),
        )
}
