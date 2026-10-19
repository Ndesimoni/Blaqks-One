use crate::config::SignupMode;
use crate::error::{ApiError, ApiResult};
use axum::http::StatusCode;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Outcome {
    Pass,
    Fail,
    Unavailable,
}

pub trait BotCheck: Send + Sync {
    fn provider(&self) -> &'static str;
    fn verify(&self, token: &str, action: &str) -> Outcome;
}

pub fn require(check: &dyn BotCheck, token: &str, action: &str) -> ApiResult<()> {
    match check.verify(token, action) {
        Outcome::Pass => Ok(()),
        Outcome::Fail => Err(ApiError(
            StatusCode::BAD_REQUEST,
            "We couldn't confirm you're human. Try again.",
            "bot_check_failed",
        )),
        Outcome::Unavailable => Err(ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            "Human verification is temporarily unavailable.",
            "bot_check_unavailable",
        )),
    }
}

pub struct LocalBypass {
    mode: SignupMode,
}

impl LocalBypass {
    pub fn new(mode: SignupMode) -> Self {
        Self { mode }
    }
}

impl BotCheck for LocalBypass {
    fn provider(&self) -> &'static str {
        "local"
    }

    fn verify(&self, token: &str, action: &str) -> Outcome {
        if self.mode == SignupMode::Local
            && token == "local-development"
            && matches!(action, "signup_start" | "signup_resend")
        {
            Outcome::Pass
        } else {
            Outcome::Fail
        }
    }
}
