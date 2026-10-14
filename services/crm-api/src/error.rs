use axum::{http::StatusCode, response::IntoResponse, Json};
use serde_json::json;

#[derive(Debug)]
pub struct ApiError(pub StatusCode, pub &'static str, pub &'static str);

pub type ApiResult<T> = Result<T, ApiError>;

impl ApiError {
    pub fn invalid(message: &'static str) -> Self {
        Self(StatusCode::BAD_REQUEST, message, "invalid_request")
    }

    pub fn forbidden() -> Self {
        Self(StatusCode::FORBIDDEN, "Access denied.", "forbidden")
    }

    /// A 403 with a specific, non-revealing explanation (for example H2 deletes).
    pub fn denied(message: &'static str) -> Self {
        Self(StatusCode::FORBIDDEN, message, "forbidden")
    }

    pub fn unauthorized() -> Self {
        Self(
            StatusCode::UNAUTHORIZED,
            "Sign in to continue.",
            "unauthorized",
        )
    }

    pub fn conflict(message: &'static str) -> Self {
        Self(StatusCode::CONFLICT, message, "conflict")
    }

    pub fn link_missing(message: &'static str) -> Self {
        Self(StatusCode::CONFLICT, message, "link_missing")
    }

    pub fn stale(message: &'static str) -> Self {
        Self(StatusCode::CONFLICT, message, "version_conflict")
    }

    pub fn missing() -> Self {
        Self(StatusCode::NOT_FOUND, "Record not found.", "not_found")
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        if let Some(database) = error.as_database_error() {
            match database.code().as_deref() {
                Some("23505") => return Self::conflict("That record ID is already in use."),
                Some("23503") => return Self::conflict("A linked record prevents this change."),
                // The crm_check_assignee trigger raises 23514 with no constraint name; a
                // named CHECK constraint is a server bug and stays on the generic 503.
                Some("23514") if database.constraint().is_none() => {
                    return Self::conflict("That team member can no longer receive this record.")
                }
                _ => {}
            }
        }
        Self(
            StatusCode::SERVICE_UNAVAILABLE,
            "The database operation could not be completed.",
            "database_unavailable",
        )
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (self.0, Json(json!({"message": self.1, "code": self.2}))).into_response()
    }
}

#[cfg(test)]
#[path = "error_tests.rs"]
mod tests;
