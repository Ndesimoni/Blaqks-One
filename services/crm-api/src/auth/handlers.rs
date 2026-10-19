use super::{
    device, password,
    profile::{Profile, UserRow},
    protection,
    session::{self, Session},
    sessions, throttle,
};
use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, State},
    http::{header, HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::FromRow;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LoginRequest {
    email: String,
    password: String,
}

#[derive(FromRow)]
struct Credentials {
    #[sqlx(flatten)]
    user: UserRow,
    password_hash: String,
}

pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Result<Json<LoginRequest>, JsonRejection>,
) -> ApiResult<(HeaderMap, Json<Value>)> {
    protection::origin(&state, &headers)?;
    let Json(request) =
        body.map_err(|_| ApiError::invalid("Provide a JSON email and password."))?;
    let email = request.email.trim().to_lowercase();
    if email.len() > 254 || request.password.len() > 1024 {
        return Err(ApiError::invalid("Sign-in values are too long."));
    }
    throttle::check(&state.pool, &email).await?;
    let credentials = sqlx::query_as::<_, Credentials>(
        "SELECT * FROM crm_user_profiles WHERE email=$1 AND active AND owner_active",
    )
    .bind(&email)
    .fetch_optional(&state.pool)
    .await?;
    let hash = credentials
        .as_ref()
        .map(|user| user.password_hash.clone())
        .unwrap_or_else(|| state.dummy_hash.as_ref().clone());
    let permit = state
        .password_workers
        .acquire()
        .await
        .map_err(|_| ApiError::invalid("Authentication is temporarily unavailable."))?;
    let valid = password::verify(request.password, hash).await?;
    drop(permit);
    let user = credentials.filter(|_| valid).ok_or(ApiError(
        StatusCode::UNAUTHORIZED,
        "Email or password is incorrect.",
        "invalid_credentials",
    ))?;
    let mut transaction = state.pool.begin().await?;
    crate::workspaces::lock(&mut transaction, &user.user.workspace_id).await?;
    let live_user = sqlx::query_as::<_, UserRow>(
        "SELECT * FROM crm_user_profiles WHERE id=$1 AND active AND owner_active",
    )
    .bind(user.user.id)
    .fetch_optional(&mut *transaction)
    .await?
    .ok_or_else(ApiError::unauthorized)?;
    sqlx::query("DELETE FROM crm_sessions WHERE expires_at<=now()")
        .execute(&mut *transaction)
        .await?;
    let agent = headers
        .get(header::USER_AGENT)
        .and_then(|value| value.to_str().ok());
    let label = device::label(agent);
    let issued = sessions::issue(&mut transaction, user.user.id, label.as_deref()).await?;
    let company =
        crate::workspaces::company::get(&mut *transaction, &live_user.workspace_id).await?;
    transaction.commit().await?;
    let profile = Profile::from(live_user);
    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::SET_COOKIE,
        session::cookie(&issued.token, state.config.secure_cookie, false)
            .parse()
            .unwrap(),
    );
    Ok((
        response_headers,
        Json(json!({"user": profile, "csrfToken": issued.csrf_token, "company": company})),
    ))
}

pub async fn current(State(state): State<AppState>, session: Session) -> ApiResult<Json<Value>> {
    let company = crate::workspaces::company::get(&state.pool, &session.user.workspace_id).await?;
    Ok(Json(
        json!({"user": Profile::from(session.user), "csrfToken": session.csrf_token, "company": company}),
    ))
}

pub async fn logout(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
) -> ApiResult<(HeaderMap, Json<Value>)> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    sqlx::query("DELETE FROM crm_sessions WHERE token_hash=$1")
        .bind(session.token_hash)
        .execute(&state.pool)
        .await?;
    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::SET_COOKIE,
        session::cookie("", state.config.secure_cookie, true)
            .parse()
            .unwrap(),
    );
    Ok((response_headers, Json(json!({"ok": true}))))
}
