//! Neutral names for files shown outside the uploader's company (marketplace MK1 code review
//! M2): the name the uploader typed (it may hold a phone number or a client's name) never
//! reaches another company. Serving adds the stored type's extension (`naming::typed_name`).
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Renames the owned file `id` of `owner` to `name` (no extension).
pub async fn rename(
    tx: &mut Transaction<'_, Postgres>,
    (kind, owner): (&str, Uuid),
    id: Uuid,
    name: &str,
) -> ApiResult<()> {
    sqlx::query(
        "UPDATE media.crm_media_objects SET file_name=$4 \
         WHERE id=$1 AND owner_kind=$2 AND owner_id=$3 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(kind)
    .bind(owner)
    .bind(name)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
