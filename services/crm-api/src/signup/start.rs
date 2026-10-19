use super::{
    bot, cleanup, code,
    delivery::Message,
    identity, limits,
    model::{StartRequest, StartResponse},
    validation,
};
use crate::{
    auth::{password, protection, session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::company::AccountType,
};
use axum::{
    extract::{rejection::JsonRejection, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use std::time::Duration;
use uuid::Uuid;

pub async fn start(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Result<Json<StartRequest>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<StartResponse>)> {
    protection::origin(&state, &headers)?;
    cleanup::run(&state.pool).await?;
    let Json(request) = body.map_err(|_| ApiError::invalid("Provide valid sign-up details."))?;
    let request = validation::start(request)?;
    bot::require(
        state.signup.bot.as_ref(),
        &request.bot_token,
        "signup_start",
    )?;
    limits::start(&state.pool, &request.email).await?;
    let signup_workers = state.signup.password_workers.clone();
    let password_workers = state.password_workers.clone();
    let permits = tokio::time::timeout(Duration::from_secs(2), async move {
        let signup = signup_workers.acquire_owned().await.ok()?;
        let shared = password_workers.acquire_owned().await.ok()?;
        Some((signup, shared))
    })
    .await
    .ok()
    .flatten()
    .ok_or(ApiError(
        StatusCode::SERVICE_UNAVAILABLE,
        "Sign-up is temporarily busy. Try again.",
        "signup_busy",
    ))?;
    let password_hash = password::hash(request.password).await?;
    drop(permits);
    let classification = identity::classify(&state.pool, &request.email).await?;
    let deliver = if classification.existing {
        limits::notice(&state.pool, &request.email).await?
    } else {
        true
    };
    let ticket = session::random_token();
    let verification = code::generate();
    let code_hash = code::digest(&ticket, &verification);
    let mut transaction = state.pool.begin().await?;
    let (id, expires_at): (Uuid, String) = sqlx::query_as(
        "INSERT INTO crm_signup_requests (ticket_hash,email,existing_account,notice_kind, \
         account_type,name,phone,password_hash,language,terms_version,privacy_version,code_hash) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id, \
         to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')",
    )
    .bind(session::digest(&ticket))
    .bind(&request.email)
    .bind(classification.existing)
    .bind(classification.notice)
    .bind(AccountType::Brokerage.name())
    .bind(&request.name)
    .bind(&request.phone)
    .bind(password_hash)
    .bind(request.language)
    .bind(&request.terms)
    .bind(&request.privacy)
    .bind(code_hash)
    .fetch_one(&mut *transaction)
    .await?;
    let kind = classification.notice.unwrap_or("code");
    let delivered_code = (!classification.existing).then_some(verification);
    let outbox: Uuid = sqlx::query_scalar(
        "INSERT INTO crm_signup_outbox (request_id,kind,code,delivered_at) \
         VALUES ($1,$2,$3,CASE WHEN $4 THEN NULL ELSE now() END) RETURNING id",
    )
    .bind(id)
    .bind(kind)
    .bind(&delivered_code)
    .bind(deliver)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    let masked_email = code::mask(&request.email);
    if deliver {
        state
            .signup
            .delivery
            .deliver(Message {
                id: outbox,
                code: delivered_code,
                masked_email: masked_email.clone(),
                expires_at: expires_at.clone(),
            })
            .await?;
    }
    Ok((
        StatusCode::ACCEPTED,
        Json(StartResponse {
            request_id: ticket,
            masked_email,
            expires_at,
            resend_after_seconds: 60,
        }),
    ))
}
