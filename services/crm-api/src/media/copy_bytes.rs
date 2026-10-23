//! The byte step of a listing-share copy (migration 0069): each reserved copy's source is
//! read, checked against its recorded SHA-256 and written under the copy's own key, with no
//! transaction open; the row is then marked stored. Any failure hides every reservation, as
//! does a refused share for whatever it left unattached. At most `PARALLEL` files are copied
//! at once across the server (R2a security review M5); a copy whose row the sweep hid while
//! its bytes moved is removed again here, so no stored object is left behind (review L9).
use super::{
    copies::{Reserved, FAILED},
    s3,
    sigv4::sha256_hex,
};
use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::http::StatusCode;
use sqlx::PgPool;
use tokio::sync::Semaphore;
use uuid::Uuid;

const MAX_BYTES: usize = 21 * 1024 * 1024;
const PARALLEL: usize = 4;
static COPYING: Semaphore = Semaphore::const_new(PARALLEL);

/// Copies each reserved file's bytes and marks it stored. On any failure every reservation
/// is hidden (the sweep removes what was written) and the share is refused.
pub async fn store(state: &AppState, reserved: &[Reserved]) -> ApiResult<()> {
    let config = state
        .config
        .media
        .as_ref()
        .ok_or_else(super::upload::unconfigured)?;
    let failed = || ApiError(StatusCode::SERVICE_UNAVAILABLE, FAILED, "media_unavailable");
    for copy in reserved {
        let permit = COPYING.acquire().await.map_err(|_| failed())?;
        let bytes = s3::get(config, &copy.source.storage_key, MAX_BYTES).await;
        let stored = match bytes {
            Ok(bytes) if sha256_hex(&bytes) == copy.source.sha256 => {
                s3::put_creating(config, &copy.key, bytes, &copy.source.content_type).await
            }
            _ => Err(s3::StorageError::Unavailable),
        };
        drop(permit);
        let marked = match &stored {
            Ok(_) => sqlx::query(
                "UPDATE media.crm_media_objects SET storage_pending=false \
                 WHERE id=$1 AND deleted_at IS NULL",
            )
            .bind(copy.id)
            .execute(&state.pool)
            .await?
            .rows_affected(),
            Err(_) => 0,
        };
        if marked == 0 {
            if stored.is_ok() {
                let _ = s3::delete(config, &copy.key).await;
            }
            discard(&state.pool, &ids(reserved)).await?;
            return Err(failed());
        }
    }
    Ok(())
}

pub fn ids(reserved: &[Reserved]) -> Vec<Uuid> {
    reserved.iter().map(|copy| copy.id).collect()
}

/// Hides unattached copies at once (a refused or duplicate share); the sweep removes them.
pub async fn discard(pool: &PgPool, ids: &[Uuid]) -> ApiResult<()> {
    sqlx::query(
        "UPDATE media.crm_media_objects SET deleted_at=now() \
         WHERE id=ANY($1) AND origin='copy' AND owner_id IS NULL AND deleted_at IS NULL",
    )
    .bind(ids)
    .execute(pool)
    .await?;
    Ok(())
}
