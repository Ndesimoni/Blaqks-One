use super::{audit, validation::ValidatedRecord};
use crate::error::{ApiError, ApiResult};
use serde::Serialize;
use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Serialize, FromRow)]
pub struct Entry {
    pub id: Uuid,
    pub version: i64,
    #[sqlx(rename = "payload")]
    pub record: Value,
}

pub async fn create(
    pool: &PgPool,
    actor: Uuid,
    workspace: &str,
    collection: &str,
    record: ValidatedRecord,
) -> ApiResult<Entry> {
    let id = Uuid::new_v4();
    let mut transaction = pool.begin().await?;
    crate::workspaces::lock(&mut transaction, workspace).await?;
    crate::workspaces::ensure_writable(&mut transaction, workspace, actor, Some(collection))
        .await?;
    let saved = sqlx::query_as::<_, Entry>(
        "INSERT INTO crm_records \
         (id,workspace_id,collection,legacy_id,payload,contact_id,client_ref,property_ref) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,version,payload",
    )
    .bind(id)
    .bind(workspace)
    .bind(collection)
    .bind(record.legacy_id)
    .bind(record.payload)
    .bind(record.links.contact)
    .bind(record.links.client)
    .bind(record.links.property)
    .fetch_one(&mut *transaction)
    .await?;
    audit::append(
        &mut transaction,
        actor,
        workspace,
        "created",
        collection,
        id,
    )
    .await?;
    transaction.commit().await?;
    Ok(saved)
}

pub struct Update<'a> {
    pub actor: Uuid,
    pub workspace: &'a str,
    pub collection: &'a str,
    pub id: Uuid,
    pub version: i64,
    pub record: ValidatedRecord,
}

pub async fn update(pool: &PgPool, update: Update<'_>) -> ApiResult<Entry> {
    let mut transaction = pool.begin().await?;
    crate::workspaces::lock(&mut transaction, update.workspace).await?;
    crate::workspaces::ensure_writable(
        &mut transaction,
        update.workspace,
        update.actor,
        Some(update.collection),
    )
    .await?;
    let saved = sqlx::query_as::<_, Entry>(
        "UPDATE crm_records SET legacy_id=$1,payload=$2,contact_id=$3,client_ref=$4,property_ref=$5,\
         version=version+1,updated_at=now() WHERE id=$6 AND workspace_id=$7 AND collection=$8 \
         AND version=$9 RETURNING id,version,payload",
    ).bind(update.record.legacy_id).bind(update.record.payload).bind(update.record.links.contact)
        .bind(update.record.links.client).bind(update.record.links.property).bind(update.id).bind(update.workspace).bind(update.collection).bind(update.version)
        .fetch_optional(&mut *transaction).await?;
    let saved = match saved {
        Some(saved) => saved,
        None => {
            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM crm_records WHERE id=$1 AND workspace_id=$2 AND collection=$3)",
            ).bind(update.id).bind(update.workspace).bind(update.collection)
                .fetch_one(&mut *transaction).await?;
            return Err(if exists {
                ApiError::stale("This record changed. Reload before saving.")
            } else {
                ApiError::missing()
            });
        }
    };
    audit::append(
        &mut transaction,
        update.actor,
        update.workspace,
        "updated",
        update.collection,
        update.id,
    )
    .await?;
    transaction.commit().await?;
    Ok(saved)
}
