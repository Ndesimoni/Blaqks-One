//! `POST …/marketplace/requests` (packet MK2): one transaction writes the request, its source
//! client and the event. Five open requests per member, one per client, twenty postings a day,
//! and the client must be one the poster holds (or any client for the company Admin).
use super::{events, gate, limits, request, request_view, requests, requests_close, sources};
use crate::{
    auth::{session::Session, throttle},
    error::{ApiError, ApiResult},
    records::market_requirements,
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State as AxumState},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

pub const CONSENT: &str = "Your client must agree before you post this request.";
pub const CLIENT_OPEN: &str = "This client already has an open request.";
pub const FIVE: &str = "You have five open requests. Close one, or wait for one to expire.";
pub const DAILY: &str = "You have posted 20 requests today. Try again tomorrow.";
const OPEN_LIMIT: i64 = 5;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Post {
    pub client_id: String,
    pub request: request::Input,
    pub client_consent: bool,
}

pub async fn post(
    AxumState(state): AxumState<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Post>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let Json(post) = body.map_err(|_| ApiError::invalid(request::INVALID))?;
    let mut tx = state.pool.begin().await?;
    let user = gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, user.id).await?;
    if !post.client_consent {
        return Err(ApiError::invalid(CONSENT));
    }
    let client = limits::missing_id(&post.client_id)?;
    let valid = request::validate(post.request)?;
    // The poster holds the client, or is the company Admin (the R1 sharing rule).
    market_requirements::read(&mut tx, &workspace, &user, client).await?;
    // Counted after the gate and the membership checks, so only a member can spend the budget.
    let key = format!("market-request-post:{}", user.id);
    throttle::consume_window(&state.pool, &key, 20, 86_400, DAILY, "rate_limited").await?;
    // The member's row lock makes the two limits safe under a double submit.
    sqlx::query_scalar::<_, uuid::Uuid>(
        "SELECT member_id FROM marketplace.crm_market_profiles WHERE member_id=$1 FOR UPDATE",
    )
    .bind(user.id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::conflict(gate::JOIN_FIRST))?;
    // An expired request no longer holds its client: it closes so this one can take its place.
    for (_, poster) in requests_close::close_expired_for_client(&mut tx, &workspace, client).await?
    {
        events::append(&mut tx, &workspace, user.id, poster, "request_closed").await?;
    }
    if requests_close::open_for_client(&mut tx, &workspace, client).await? {
        return Err(ApiError::conflict(CLIENT_OPEN));
    }
    if requests_close::count_open(&mut tx, user.id).await? >= OPEN_LIMIT {
        return Err(ApiError::conflict(FIVE));
    }
    let row = requests::insert(&mut tx, &workspace, user.id, &valid).await?;
    sources::insert(&mut tx, row.id, &workspace, client).await?;
    events::append(&mut tx, &workspace, user.id, user.id, "request_posted").await?;
    tx.commit().await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({ "request": request_view::mine(&row, Some(client), None) })),
    ))
}
