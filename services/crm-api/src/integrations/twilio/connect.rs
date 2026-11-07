//! Connecting the company's Twilio account (SEC-1, design §4): the Account SID and Auth
//! Token are checked for shape, then Twilio must answer the account read for that SID
//! with `200`, the same `sid` and `status = active`. Nothing typed is trusted. The SID
//! becomes the connection's account ID, so the unique index keeps one Twilio account to
//! one company, and the sealed credential is the token alone (no API keys, design §4.3).
use super::{api, shape};
use crate::{
    config::twilio_settings::TwilioConfig,
    error::{ApiError, ApiResult},
    integrations::{google::oauth::Failure, provider::ConnectedAccount},
};
use axum::http::StatusCode;

pub const REFUSED: &str = "Twilio refused these details. Check the Account SID and Auth Token.";
pub const UNAVAILABLE: &str = "Twilio could not be reached. Try again in a moment.";
pub const NOT_ACTIVE: &str =
    "This Twilio account is suspended or closed. Reactivate it in Twilio first.";

pub fn unavailable() -> ApiError {
    ApiError(
        StatusCode::SERVICE_UNAVAILABLE,
        UNAVAILABLE,
        "provider_unavailable",
    )
}

fn failure(failure: Failure) -> ApiError {
    match failure {
        // An unknown account or a refused token both mean the details are wrong.
        Failure::Refused | Failure::Invalid => ApiError::invalid(REFUSED),
        Failure::Unavailable => unavailable(),
    }
}

/// Proves that `token` opens the active account `sid`; returns the SID to store.
pub async fn prove(config: &TwilioConfig, sid: &str, token: &str) -> ApiResult<String> {
    let sid = shape::account_sid(sid).map_err(ApiError::invalid)?;
    let token = shape::auth_token(token).map_err(ApiError::invalid)?;
    let account = api::account(config, sid, token).await.map_err(failure)?;
    if account.sid != sid {
        return Err(ApiError::invalid(REFUSED));
    }
    if account.status != "active" {
        return Err(ApiError::invalid(NOT_ACTIVE));
    }
    Ok(sid.to_owned())
}

pub async fn account(
    config: &TwilioConfig,
    label: &str,
    sid: &str,
    token: &str,
) -> ApiResult<ConnectedAccount> {
    Ok(ConnectedAccount {
        label: label.to_owned(),
        external_account_id: prove(config, sid, token).await?,
    })
}
