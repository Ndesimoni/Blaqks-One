use crate::{error::ApiResult, signup::retry::MAX_ATTEMPTS};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

/// A job this worker now owns until `lease_expires_at`; `attempts` includes this claim.
#[derive(FromRow)]
pub struct Claimed {
    pub id: Uuid,
    pub request_id: Uuid,
    pub attempts: i32,
    pub owner: Uuid,
    pub email: String,
    pub expires_at: String,
    pub expired: bool,
    pub code_expired: bool,
}

/// Claims one due job with `FOR UPDATE SKIP LOCKED`, so two workers can never own it. An
/// expired lease is claimable, which recovers work after a restart or crash. A job is
/// claimed at most `MAX_ATTEMPTS` times; cleanup ends one that crashes on every claim.
pub async fn claim(pool: &PgPool, owner: Uuid, lease_secs: i64) -> ApiResult<Option<Claimed>> {
    sqlx::query_as(
        "WITH candidate AS ( \
            SELECT id FROM crm_signup_outbox \
            WHERE delivered_at IS NULL AND terminal_at IS NULL AND superseded_at IS NULL \
              AND next_attempt_at<=now() \
              AND (lease_expires_at IS NULL OR lease_expires_at<=now()) AND attempts<$3 \
            ORDER BY next_attempt_at,created_at LIMIT 1 FOR UPDATE SKIP LOCKED), \
         claimed AS ( \
            UPDATE crm_signup_outbox o SET lease_owner=$1, \
              lease_expires_at=now()+make_interval(secs=>$2), attempts=o.attempts+1 \
            FROM candidate c WHERE o.id=c.id RETURNING o.*) \
         SELECT c.id,c.request_id,c.attempts,c.lease_owner AS owner,r.email, \
           to_char(r.expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS expires_at, \
           r.expires_at<=now() AS expired, \
           (c.kind='code' AND r.code_expires_at<=now()) AS code_expired \
         FROM claimed c JOIN crm_signup_requests r ON r.id=c.request_id",
    )
    .bind(owner)
    .bind(lease_secs as f64)
    .bind(MAX_ATTEMPTS)
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}
