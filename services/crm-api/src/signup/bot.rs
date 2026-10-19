use crate::config::SignupMode;
use crate::error::{ApiError, ApiResult};
use axum::http::StatusCode;
use std::{future::Future, pin::Pin, sync::Arc};

/// Builds the Turnstile adapter without exposing the module outside sign-up.
pub fn turnstile(config: &crate::config::TurnstileConfig) -> Result<Arc<dyn BotCheck>, String> {
    Ok(Arc::new(super::turnstile::Turnstile::new(config)?))
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Outcome {
    Pass,
    Fail,
    Unavailable,
}

pub trait BotCheck: Send + Sync {
    fn provider(&self) -> &'static str;
    /// The public widget key; `None` for providers that render no widget.
    fn site_key(&self) -> Option<&str> {
        None
    }
    fn verify<'a>(
        &'a self,
        token: &'a str,
        action: &'a str,
    ) -> Pin<Box<dyn Future<Output = Outcome> + Send + 'a>>;
}

pub async fn require(check: &dyn BotCheck, token: &str, action: &str) -> ApiResult<()> {
    match check.verify(token, action).await {
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

    fn verify<'a>(
        &'a self,
        token: &'a str,
        action: &'a str,
    ) -> Pin<Box<dyn Future<Output = Outcome> + Send + 'a>> {
        Box::pin(async move {
            if self.mode == SignupMode::Local
                && token == "local-development"
                && matches!(action, "signup_start" | "signup_resend")
            {
                Outcome::Pass
            } else {
                Outcome::Fail
            }
        })
    }
}
