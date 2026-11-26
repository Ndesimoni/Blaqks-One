use super::{bot, cleanup, code, limits, model::ResendRequest, resend_response};
use crate::{
    auth::{protection, session},
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, ConnectInfo, State},
    http::HeaderMap,
    response::Response,
    Json,
};
use sqlx::FromRow;
use std::net::SocketAddr;
use uuid::Uuid;

#[derive(FromRow)]
struct Row {
    id: Uuid,
    email: String,
    existing_account: bool,
    notice_kind: Option<String>,
    sends: i32,
    total_attempts: i32,
    retry_after: i32,
    expires_at: String,
}

pub async fn resend(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Result<Json<ResendRequest>, JsonRejection>,
) -> ApiResult<Response> {
    protection::origin(&state, &headers)?;
    let client = state.signup.clients.digest(peer, &headers)?;
    limits::client_resend(&state.pool, &client).await?;
    cleanup::run(&state.pool).await?;
    let Json(request) = body.map_err(|_| ApiError::invalid("Provide a valid sign-up request."))?;
    bot::require(
        state.signup.bot.as_ref(),
        &request.bot_token,
        "signup_resend",
    )
    .await?;
    if request.request_id.len() != 43 {
        return resend_response::anonymous(&state.pool).await;
    }
    let mut transaction = state.pool.begin().await?;
    let row = sqlx::query_as::<_, Row>(
        r#"SELECT id,email,existing_account,notice_kind,sends,total_attempts,
           GREATEST(0,ceil(extract(epoch FROM last_sent_at+interval '60 seconds'-now())))::int
             AS retry_after,
           to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS expires_at
           FROM crm_signup_requests
           WHERE ticket_hash=$1 AND expires_at>now() AND consumed_at IS NULL FOR UPDATE"#,
    )
    .bind(session::digest(&request.request_id))
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(row) = row else {
        transaction.rollback().await?;
        return resend_response::anonymous(&state.pool).await;
    };
    // The same request lock the delivery worker takes; an old code cannot be sent after
    // this resend supersedes it.
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(row.id.to_string())
        .execute(&mut *transaction)
        .await?;
    if row.retry_after > 0 {
        transaction.rollback().await?;
        return Ok(resend_response::busy(
            "resend_too_soon",
            "Wait before requesting another code.",
            Some(row.retry_after),
        ));
    }
    if row.sends >= 5 || row.total_attempts >= 10 {
        transaction.rollback().await?;
        return Ok(resend_response::busy(
            "rate_limited",
            "Request a new sign-up code to continue.",
            None,
        ));
    }
    limits::resend(&state.pool, &row.email).await?;
    let deliver = if row.existing_account {
        limits::notice(&state.pool, &row.email).await?
    } else {
        true
    };
    let verification = code::generate();
    sqlx::query(
        r#"UPDATE crm_signup_requests SET code_hash=$2,
           code_expires_at=LEAST(now()+interval '10 minutes',expires_at),
           code_attempts=0,sends=sends+1,last_sent_at=now() WHERE id=$1"#,
    )
    .bind(row.id)
    .bind(code::digest(&request.request_id, &verification))
    .execute(&mut *transaction)
    .await?;
    sqlx::query(
        r#"UPDATE crm_signup_outbox SET superseded_at=now(),terminal_at=now(),code=NULL,
           lease_owner=NULL,lease_expires_at=NULL
           WHERE request_id=$1 AND kind='code' AND delivered_at IS NULL AND terminal_at IS NULL"#,
    )
    .bind(row.id)
    .execute(&mut *transaction)
    .await?;
    let kind = row.notice_kind.as_deref().unwrap_or("code");
    let delivered_code = (!row.existing_account).then_some(verification);
    sqlx::query(
        r#"INSERT INTO crm_signup_outbox(request_id,kind,code,terminal_at)
           VALUES($1,$2,$3,CASE WHEN $4 THEN NULL ELSE now() END)"#,
    )
    .bind(row.id)
    .bind(kind)
    .bind(&delivered_code)
    .bind(deliver)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(resend_response::accepted(row.expires_at))
}
