//! What owning modules call inside their own transactions (packet F1): attach a member's
//! pending uploads to an item, list an item's files, find one for serving, and remove them.
use super::store::{Item, Stored, ITEM};
use crate::error::{ApiError, ApiResult};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'a> = Transaction<'a, Postgres>;

/// Attaches the uploader's own pending files to an item; every ID must qualify.
pub async fn attach(
    tx: &mut Tx<'_>,
    workspace: &str,
    uploader: Uuid,
    ids: &[Uuid],
    kind: &str,
    owner: Uuid,
) -> ApiResult<Vec<Item>> {
    let items: Vec<Item> = sqlx::query_as(&format!(
        "UPDATE media.crm_media_objects SET owner_kind=$4,owner_id=$5,attached_at=now() \
         WHERE id=ANY($1) AND workspace_id=$2 AND uploaded_by=$3 AND origin='upload' \
           AND owner_id IS NULL \
           AND deleted_at IS NULL AND created_at>now()-interval '24 hours' RETURNING {ITEM}"
    ))
    .bind(ids)
    .bind(workspace)
    .bind(uploader)
    .bind(kind)
    .bind(owner)
    .fetch_all(&mut **tx)
    .await?;
    if items.len() != ids.len() {
        return Err(ApiError::invalid(
            "Attach files you uploaded in the last day.",
        ));
    }
    Ok(items)
}

/// The visible files of these items, with their owner.
pub async fn list(tx: &mut Tx<'_>, kind: &str, owners: &[Uuid]) -> ApiResult<Vec<(Uuid, Item)>> {
    #[derive(FromRow)]
    struct Row {
        owner_id: Uuid,
        #[sqlx(flatten)]
        item: Item,
    }
    let rows: Vec<Row> = sqlx::query_as(&format!(
        "SELECT owner_id,{ITEM} FROM media.crm_media_objects \
         WHERE owner_kind=$1 AND owner_id=ANY($2) AND deleted_at IS NULL ORDER BY attached_at,id"
    ))
    .bind(kind)
    .bind(owners)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.owner_id, row.item))
        .collect())
}

/// One visible file of this item in this company.
pub async fn find(
    tx: &mut Tx<'_>,
    workspace: &str,
    kind: &str,
    owner: Uuid,
    id: Uuid,
) -> ApiResult<Option<Stored>> {
    sqlx::query_as(
        "SELECT storage_key,file_name,content_type FROM media.crm_media_objects \
         WHERE id=$1 AND workspace_id=$2 AND owner_kind=$3 AND owner_id=$4 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(workspace)
    .bind(kind)
    .bind(owner)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

/// Hides an item's files at once; the sweep removes them from storage.
pub async fn remove(tx: &mut Tx<'_>, kind: &str, owner: Uuid) -> ApiResult<()> {
    sqlx::query(
        "UPDATE media.crm_media_objects SET deleted_at=now() \
         WHERE owner_kind=$1 AND owner_id=$2 AND deleted_at IS NULL",
    )
    .bind(kind)
    .bind(owner)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The IDs of an item's visible files.
pub async fn ids(tx: &mut Tx<'_>, kind: &str, owner: Uuid) -> ApiResult<Vec<Uuid>> {
    sqlx::query_scalar(
        "SELECT id FROM media.crm_media_objects \
         WHERE owner_kind=$1 AND owner_id=$2 AND deleted_at IS NULL",
    )
    .bind(kind)
    .bind(owner)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}

/// Hides some of an item's files at once; the sweep removes them from storage.
pub async fn remove_ids(tx: &mut Tx<'_>, kind: &str, owner: Uuid, ids: &[Uuid]) -> ApiResult<()> {
    sqlx::query(
        "UPDATE media.crm_media_objects SET deleted_at=now() \
         WHERE owner_kind=$1 AND owner_id=$2 AND id=ANY($3) AND deleted_at IS NULL",
    )
    .bind(kind)
    .bind(owner)
    .bind(ids)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Hides one workspace's files for several deleted items (sample-data clearing).
pub async fn remove_owners(
    tx: &mut Tx<'_>,
    workspace: &str,
    kind: &str,
    owners: &[Uuid],
) -> ApiResult<()> {
    sqlx::query(
        "UPDATE media.crm_media_objects SET deleted_at=now() \
         WHERE workspace_id=$1 AND owner_kind=$2 AND owner_id=ANY($3) AND deleted_at IS NULL",
    )
    .bind(workspace)
    .bind(kind)
    .bind(owners)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
