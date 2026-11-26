use crate::error::ApiError;
use axum::http::StatusCode;

pub fn invalid(locked: bool) -> ApiError {
    if locked {
        ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            "Request a new sign-up code to continue.",
            "code_locked",
        )
    } else {
        ApiError(
            StatusCode::BAD_REQUEST,
            "The verification code is incorrect or expired.",
            "invalid_code",
        )
    }
}
