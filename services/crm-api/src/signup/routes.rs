use super::{resend, start, verify};
use crate::{auth::consents, config::SignupMode, error::ApiResult, state::AppState};
use axum::{
    extract::{DefaultBodyLimit, State},
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};

async fn status(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let enabled = state.config.signup == SignupMode::Local;
    Ok(Json(json!({
        "enabled": enabled,
        "mode": if enabled { "local" } else { "off" },
        "botCheck": if enabled {
            Some(json!({
                "provider": state.signup.bot.provider(),
                "siteKey": state.signup.bot.site_key(),
            }))
        } else {
            None
        },
        "terms": {"version": consents::TERMS_VERSION, "url": "/terms"},
        "privacy": {"version": consents::PRIVACY_VERSION, "url": "/privacy"},
    })))
}

pub fn router(mode: SignupMode) -> Router<AppState> {
    let router = Router::new().route("/api/crm/signup/status", get(status));
    if mode == SignupMode::Off {
        return router;
    }
    let limit = || DefaultBodyLimit::max(16 * 1024);
    router
        .route("/api/crm/signup/start", post(start::start).layer(limit()))
        .route(
            "/api/crm/signup/resend",
            post(resend::resend).layer(limit()),
        )
        .route(
            "/api/crm/signup/verify",
            post(verify::verify).layer(limit()),
        )
}
