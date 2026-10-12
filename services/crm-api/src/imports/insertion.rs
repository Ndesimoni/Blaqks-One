use super::model::ImportRecords;
use crate::{
    error::ApiResult,
    records::{audit, validation},
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn insert(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
    records: ImportRecords,
) -> ApiResult<()> {
    for (collection, rows) in records.collections() {
        for row in rows {
            let record = validation::validate(collection, row.clone())?;
            let id = Uuid::new_v4();
            sqlx::query(
                "INSERT INTO crm_records (id,workspace_id,collection,legacy_id,payload,contact_id) \
                 VALUES ($1,$2,$3,$4,$5,$6)",
            ).bind(id).bind(workspace).bind(collection).bind(record.legacy_id)
                .bind(record.payload).bind(record.contact_id).execute(&mut **transaction).await?;
            audit::append(transaction, actor, workspace, "created", collection, id).await?;
        }
    }
    Ok(())
}
