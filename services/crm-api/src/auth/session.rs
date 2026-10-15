use super::profile::UserRow;
use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::FromRequestParts,
    http::{header, request::Parts},
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use sqlx::FromRow;
use uuid::Uuid;

pub const COOKIE_NAME: &str = "kws_crm_session";

pub struct Session {
    pub user: UserRow,
    pub csrf_token: String,
    pub token_hash: String,
    /// The session's public ID (`crm_sessions.id`), never its token hash.
    pub id: Uuid,
    /// The coarse "Browser · OS" label stored at sign-in.
    pub device: Option<String>,
}

#[derive(FromRow)]
struct SessionRow {
    #[sqlx(flatten)]
    user: UserRow,
    csrf_token: String,
    session_id: Uuid,
    device: Option<String>,
    stale: bool,
}

pub fn random_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn digest(value: &str) -> String {
    let bytes = Sha256::digest(value.as_bytes());
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn cookie(token: &str, secure: bool, expire: bool) -> String {
    format!(
        "{COOKIE_NAME}={token}; Path=/api/crm; HttpOnly; SameSite=Strict; Max-Age={}{}",
        if expire { 0 } else { 8 * 60 * 60 },
        if secure { "; Secure" } else { "" }
    )
}

impl FromRequestParts<AppState> for Session {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> ApiResult<Self> {
        let cookies = parts.headers.get_all(header::COOKIE).iter();
        let tokens: Vec<&str> = cookies
            .filter_map(|cookie| cookie.to_str().ok())
            .flat_map(|cookie| cookie.split(';'))
            .filter_map(|pair| pair.trim().split_once('='))
            .filter_map(|(name, value)| (name == COOKIE_NAME).then_some(value))
            .collect();
        if tokens.len() != 1 || tokens[0].len() != 43 {
            return Err(ApiError::unauthorized());
        }
        let token_hash = digest(tokens[0]);
        let row = sqlx::query_as::<_, SessionRow>(
            "SELECT u.*,s.csrf_token,s.id AS session_id,s.device, \
             s.last_seen_at<now()-interval '5 minutes' AS stale FROM crm_sessions s \
             JOIN crm_user_profiles u ON u.id=s.user_id \
             WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active AND u.owner_active",
        )
        .bind(&token_hash)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(ApiError::unauthorized)?;
        // Last seen is refreshed at most every 5 minutes, so most requests only read.
        if row.stale {
            sqlx::query("UPDATE crm_sessions SET last_seen_at=now() WHERE token_hash=$1")
                .bind(&token_hash)
                .execute(&state.pool)
                .await?;
        }
        Ok(Self {
            user: row.user,
            csrf_token: row.csrf_token,
            token_hash,
            id: row.session_id,
            device: row.device,
        })
    }
}

#[cfg(test)]
#[path = "session_tests.rs"]
mod tests;
