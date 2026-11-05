use crate::error::ApiResult;
use axum::{
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use serde_json::json;
use sqlx::PgPool;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Body {
    pub expires_at: String,
    pub resend_after_seconds: i32,
}

pub fn accepted(expires_at: String) -> Response {
    (
        StatusCode::ACCEPTED,
        Json(Body {
            expires_at,
            resend_after_seconds: 60,
        }),
    )
        .into_response()
}

pub fn busy(code: &'static str, message: &'static str, retry: Option<i32>) -> Response {
    let mut response = (
        StatusCode::TOO_MANY_REQUESTS,
        Json(json!({"message": message, "code": code})),
    )
        .into_response();
    if let Some(seconds) = retry {
        response.headers_mut().insert(
            header::RETRY_AFTER,
            HeaderValue::from_str(&seconds.to_string()).unwrap(),
        );
    }
    response
}

pub async fn anonymous(pool: &PgPool) -> ApiResult<Response> {
    let expires_at: String = sqlx::query_scalar(
        "SELECT to_char((now()+interval '30 minutes') AT TIME ZONE 'UTC', \
         'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')",
    )
    .fetch_one(pool)
    .await?;
    Ok(accepted(expires_at))
}
