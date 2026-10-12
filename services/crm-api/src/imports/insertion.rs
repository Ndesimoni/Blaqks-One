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
                "INSERT INTO crm_records \
                 (id,workspace_id,collection,legacy_id,payload,contact_id,client_ref,property_ref,\
                 referral_ref) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            )
            .bind(id)
            .bind(workspace)
            .bind(collection)
            .bind(record.legacy_id)
            .bind(record.payload)
            .bind(record.links.contact)
            .bind(record.links.client)
            .bind(record.links.property)
            .bind(record.links.referral)
            .execute(&mut **transaction)
            .await?;
            audit::append(transaction, actor, workspace, "created", collection, id).await?;
        }
    }
    Ok(())
}
