//! SQL for the inbound loop: claim a received event under a lease, then settle it. The
//! sealed body is deleted whenever the event leaves `received`.
use crate::error::ApiResult;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(FromRow)]
pub struct Claimed {
    pub id: Uuid,
    pub workspace_id: String,
    pub connection_id: Uuid,
    pub provider: String,
    pub attempts: i32,
    pub disconnected: bool,
    pub sealed: Vec<u8>,
    pub key_version: i32,
}

/// Claims the oldest received event with `FOR UPDATE SKIP LOCKED`; an expired lease is
/// claimable again, so a crashed worker's event is retried.
pub async fn claim(
    pool: &PgPool,
    owner: Uuid,
    lease_secs: i64,
    max_attempts: i32,
) -> ApiResult<Option<Claimed>> {
    sqlx::query_as(
        "WITH candidate AS ( \
            SELECT id FROM integrations.crm_webhook_receipts \
            WHERE outcome='received' AND attempts<$3 \
              AND (lease_expires_at IS NULL OR lease_expires_at<=now()) \
            ORDER BY received_at LIMIT 1 FOR UPDATE SKIP LOCKED), \
         claimed AS ( \
            UPDATE integrations.crm_webhook_receipts r SET lease_owner=$1, \
              lease_expires_at=now()+make_interval(secs=>$2),attempts=r.attempts+1 \
            FROM candidate c WHERE r.id=c.id RETURNING r.*) \
         SELECT c.id,c.workspace_id,c.connection_id,c.provider,c.attempts, \
           k.state='disconnected' AS disconnected,s.payload_sealed AS sealed,s.key_version \
         FROM claimed c \
         JOIN integrations.crm_channel_connections k ON k.id=c.connection_id \
         JOIN integrations.crm_webhook_staging s ON s.receipt_id=c.id",
    )
    .bind(owner)
    .bind(lease_secs as f64)
    .bind(max_attempts)
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}

/// Ends an event (`processed`, `rejected` or `failed`) and deletes its sealed body, only
/// while this worker still holds the lease.
pub async fn settle(
    pool: &PgPool,
    id: Uuid,
    owner: Uuid,
    outcome: &str,
    code: Option<&str>,
) -> ApiResult<()> {
    let mut transaction = pool.begin().await?;
    let settled = sqlx::query(
        "UPDATE integrations.crm_webhook_receipts SET outcome=$3,failure_code=$4, \
           processed_at=now(),lease_owner=NULL,lease_expires_at=NULL \
         WHERE id=$1 AND lease_owner=$2 AND outcome='received'",
    )
    .bind(id)
    .bind(owner)
    .bind(outcome)
    .bind(code)
    .execute(&mut *transaction)
    .await?
    .rows_affected();
    if settled == 1 {
        sqlx::query("DELETE FROM integrations.crm_webhook_staging WHERE receipt_id=$1")
            .bind(id)
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await?;
    Ok(())
}

/// Ends events that used every claim without settling (a worker crashed on its last try,
/// or the staging row is gone) and deletes their bodies (X2-S5).
pub async fn exhaust(pool: &PgPool, max_attempts: i32) -> ApiResult<u64> {
    let mut transaction = pool.begin().await?;
    let ended: Vec<Uuid> = sqlx::query_scalar(
        "UPDATE integrations.crm_webhook_receipts SET outcome='failed', \
           failure_code='attempts_exhausted',processed_at=now(),lease_owner=NULL, \
           lease_expires_at=NULL \
         WHERE outcome='received' AND attempts>=$1 \
           AND (lease_expires_at IS NULL OR lease_expires_at<=now()) RETURNING id",
    )
    .bind(max_attempts)
    .fetch_all(&mut *transaction)
    .await?;
    sqlx::query("DELETE FROM integrations.crm_webhook_staging WHERE receipt_id=ANY($1)")
        .bind(&ended)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(ended.len() as u64)
}

/// Gives the lease back so the event is retried on a later claim.
pub async fn release(pool: &PgPool, id: Uuid, owner: Uuid) -> ApiResult<()> {
    sqlx::query(
        "UPDATE integrations.crm_webhook_receipts SET lease_owner=NULL,lease_expires_at=NULL \
         WHERE id=$1 AND lease_owner=$2",
    )
    .bind(id)
    .bind(owner)
    .execute(pool)
    .await?;
    Ok(())
}

/// A sink's failure code if it is a stored-word shape, else a generic one (X2-S6).
pub fn safe(code: &'static str) -> &'static str {
    let ok =
        (1..=40).contains(&code.len()) && code.bytes().all(|b| b.is_ascii_lowercase() || b == b'_');
    if ok {
        code
    } else {
        "sink_failed"
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn sink_codes_that_cannot_be_stored_become_generic() {
        assert_eq!(super::safe("unsupported_event"), "unsupported_event");
        assert_eq!(super::safe("Bad Code"), "sink_failed");
        assert_eq!(super::safe(""), "sink_failed");
    }
}
