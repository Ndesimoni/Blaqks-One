use super::{cleanup, code, model::VerifyRequest, verify_store};
use crate::{
    auth::{device, profile::Profile, protection, session},
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

fn invalid() -> ApiError {
    ApiError(
        StatusCode::BAD_REQUEST,
        "The verification code is incorrect or expired.",
        "invalid_code",
    )
}

pub async fn verify(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Result<Json<VerifyRequest>, JsonRejection>,
) -> ApiResult<Response> {
    protection::origin(&state, &headers)?;
    cleanup::run(&state.pool).await?;
    let Json(request) = body.map_err(|_| invalid())?;
    if request.request_id.len() != 43 || !code::valid(&request.code) {
        return Err(invalid());
    }
    let agent = headers
        .get(header::USER_AGENT)
        .and_then(|value| value.to_str().ok());
    let label = device::label(agent);
    let transaction = state.pool.begin().await?;
    let created = verify_store::verify(
        transaction,
        &request.request_id,
        &request.code,
        label.as_deref(),
    )
    .await?;
    let mut response = (
        StatusCode::CREATED,
        Json(json!({
            "user": Profile::from(created.user),
            "csrfToken": created.session.csrf_token,
            "company": created.company,
        })),
    )
        .into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        session::cookie(&created.session.token, state.config.secure_cookie, false)
            .parse()
            .unwrap(),
    );
    Ok(response)
}
