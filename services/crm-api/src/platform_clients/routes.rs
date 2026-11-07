//! Blaqks One's own clients and the marketing website's public contact intake, merged into
//! the application router by `routes.rs`.
use super::{archive, create, entries, intake, list, owners, read, update};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};

const BODY: usize = 16 * 1024;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/crm/platform/clients",
            get(list::list)
                .post(create::create)
                .layer(DefaultBodyLimit::max(BODY)),
        )
        .route("/api/crm/platform/clients/owners", get(owners::owners))
        .route(
            "/api/crm/platform/clients/{id}",
            get(read::read)
                .patch(update::update)
                .delete(archive::archive)
                .layer(DefaultBodyLimit::max(BODY)),
        )
        .route(
            "/api/crm/platform/clients/{id}/timeline",
            post(entries::log).layer(DefaultBodyLimit::max(BODY)),
        )
        .route(
            "/api/public/blaqks-one/contact",
            post(intake::contact).layer(DefaultBodyLimit::max(BODY)),
        )
}
