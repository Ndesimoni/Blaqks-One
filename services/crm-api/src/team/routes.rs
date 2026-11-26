use super::{account_type::limit, platform, platform_controls, platform_members, platform_team};
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post, put},
    Router,
};

const TEAM: &str = "/api/crm/platform/team";

pub fn router() -> Router<AppState> {
    let body = || DefaultBodyLimit::max(16 * 1024);
    Router::new()
        .route("/api/crm/platform/companies", get(platform::companies))
        .route(
            "/api/crm/platform/companies/{workspace}/members",
            get(platform_members::list),
        )
        .route(
            "/api/crm/platform/companies/{workspace}/members/{id}/active",
            put(platform_controls::set_active).layer(body()),
        )
        .route(
            "/api/crm/workspaces/{workspace}/company/seat-limit",
            put(limit::update).layer(body()),
        )
        // The Blaqks One team (BO1b), for the Owner only.
        .route(
            TEAM,
            get(platform_team::list::list)
                .post(platform_team::invite::invite)
                .layer(body()),
        )
        .route(
            &format!("{TEAM}/{{id}}"),
            axum::routing::patch(platform_team::edit::edit)
                .delete(platform_team::archive::archive)
                .layer(body()),
        )
        .route(
            &format!("{TEAM}/{{id}}/active"),
            put(platform_team::active::set_active).layer(body()),
        )
        .route(
            &format!("{TEAM}/{{id}}/invitation"),
            post(platform_team::renew::renew).layer(body()),
        )
        .route(
            &format!("{TEAM}/{{id}}/sign-out"),
            post(platform_team::credentials::sign_out).layer(body()),
        )
        .route(
            &format!("{TEAM}/{{id}}/password-reset"),
            post(platform_team::credentials::password_reset).layer(body()),
        )
}
