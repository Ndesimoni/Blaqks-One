//! Sign-in requests (migration 0038): the state is a random 256-bit token kept only as a
//! digest, the PKCE verifier is sealed, and a request is consumed once by the member,
//! workspace and session that started it, within ten minutes.
use super::super::crypto;
use crate::{
    auth::session::{digest, random_token},
    config::messaging_settings::MessagingKey,
    error::{ApiError, ApiResult},
};
use sqlx::{Postgres, Row, Transaction};
use uuid::Uuid;

/// Sign-ins a member may start in ten minutes, used or not, so a loop can neither fill
/// the table nor drive unbounded token calls to Google (security review M2).
const OPEN_LIMIT: i64 = 5;

pub struct Started {
    pub state: String,
    pub verifier: String,
}

pub struct Owner<'a> {
    pub workspace: &'a str,
    pub member: Uuid,
    pub session: Uuid,
}

pub async fn start(
    tx: &mut Transaction<'_, Postgres>,
    key: &MessagingKey,
    owner: &Owner<'_>,
) -> ApiResult<Started> {
    sqlx::query("DELETE FROM integrations.crm_oauth_requests WHERE expires_at<now()")
        .execute(&mut **tx)
        .await?;
    let open: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM integrations.crm_oauth_requests
         WHERE member_id=$1 AND expires_at>now()",
    )
    .bind(owner.member)
    .fetch_one(&mut **tx)
    .await?;
    if open >= OPEN_LIMIT {
        return Err(ApiError::invalid(
            "Too many Google sign-ins were started. Try again in ten minutes.",
        ));
    }
    let (id, state, verifier) = (Uuid::new_v4(), random_token(), random_token());
    let aad = crypto::oauth_aad(owner.workspace, &id.to_string(), "google", key.version);
    let sealed = crypto::seal(&key.bytes, &aad, verifier.as_bytes())
        .map_err(|_| ApiError::invalid("The sign-in could not be secured."))?;
    sqlx::query(
        "INSERT INTO integrations.crm_oauth_requests
         (id,state_digest,provider,workspace_id,member_id,session_id,verifier_sealed,
          key_version,expires_at)
         VALUES ($1,$2,'google',$3,$4,$5,$6,$7,now()+interval '10 minutes')",
    )
    .bind(id)
    .bind(digest(&state))
    .bind(owner.workspace)
    .bind(owner.member)
    .bind(owner.session)
    .bind(&sealed)
    .bind(key.version)
    .execute(&mut **tx)
    .await?;
    Ok(Started { state, verifier })
}

/// Marks the request used and returns its verifier, or `None` for an unknown, expired,
/// used or foreign state. Callers commit before calling Google, so a failure still burns it.
pub async fn take(
    tx: &mut Transaction<'_, Postgres>,
    key: &MessagingKey,
    owner: &Owner<'_>,
    state: &str,
) -> ApiResult<Option<String>> {
    let row = sqlx::query(
        "UPDATE integrations.crm_oauth_requests SET used_at=now()
         WHERE state_digest=$1 AND used_at IS NULL AND expires_at>now()
           AND workspace_id=$2 AND member_id=$3 AND session_id=$4
         RETURNING id,verifier_sealed,key_version",
    )
    .bind(digest(state))
    .bind(owner.workspace)
    .bind(owner.member)
    .bind(owner.session)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let (id, sealed, version): (Uuid, Vec<u8>, i32) = (
        row.get("id"),
        row.get("verifier_sealed"),
        row.get("key_version"),
    );
    if version != key.version {
        return Ok(None);
    }
    let aad = crypto::oauth_aad(owner.workspace, &id.to_string(), "google", version);
    let plain = crypto::open(&key.bytes, &aad, &sealed).map_err(|_| ApiError::missing())?;
    Ok(String::from_utf8(plain).ok())
}
