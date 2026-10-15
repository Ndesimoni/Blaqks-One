//! Locks the caller's own account for a self-service change. Callers take the workspace
//! lock first, so suspensions, archives and member edits serialise with the change.
use crate::error::{ApiError, ApiResult};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

#[derive(FromRow)]
pub struct LiveSelf {
    pub version: i64,
    pub password_hash: String,
    role: String,
    owner_id: Option<Uuid>,
}

/// Locks self `FOR UPDATE` while active and not archived, and a staff member's owning
/// Admin `FOR SHARE` while active, not archived and still an Admin. A concurrent
/// suspension or archive either commits first (this returns 401) or waits for the
/// caller's commit and then revokes every session, including any issued here.
pub async fn lock(transaction: &mut Transaction<'_, Postgres>, user: Uuid) -> ApiResult<LiveSelf> {
    let live = sqlx::query_as::<_, LiveSelf>(
        "SELECT version,password_hash,role,owner_id FROM crm_users \
         WHERE id=$1 AND active AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(user)
    .fetch_optional(&mut **transaction)
    .await?
    .ok_or_else(ApiError::unauthorized)?;
    if let Some(owner) = live.owner_id {
        sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM crm_users WHERE id=$1 AND deleted_at IS NULL \
             AND ($2<>'staff' OR (active AND role IN ('admin','super-admin'))) FOR SHARE",
        )
        .bind(owner)
        .bind(&live.role)
        .fetch_optional(&mut **transaction)
        .await?
        .ok_or_else(ApiError::unauthorized)?;
    }
    Ok(live)
}
