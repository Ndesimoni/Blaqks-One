use super::model::ImportRecords;
use crate::{
    error::ApiResult,
    records::{
        audit,
        history::{self, Change},
        validation,
        visibility::PARENTS,
    },
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn insert(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
    records: ImportRecords,
) -> ApiResult<()> {
    // Imported parents go to the destination owner (reason `import`); Follow-ups and
    // child records start unassigned. A suspended owner leaves them in the queue.
    let owner = history::active_owner(transaction, workspace).await?;
    for (collection, rows) in records.collections() {
        for row in rows {
            let record = validation::validate(collection, row.clone())?;
            let id = Uuid::new_v4();
            let assignee = owner.filter(|_| PARENTS.contains(&collection));
            sqlx::query(
                "INSERT INTO crm_records \
                 (id,workspace_id,collection,legacy_id,payload,contact_id,client_ref,property_ref,\
                 referral_ref,assignee_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
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
            .bind(assignee)
            .execute(&mut **transaction)
            .await?;
            audit::append(transaction, actor, workspace, "created", collection, id).await?;
            if assignee.is_some() {
                let change = Change {
                    workspace,
                    record: id,
                    collection,
                    from: None,
                    to: assignee,
                    actor,
                    reason: "import",
                };
                history::append(transaction, &change).await?;
            }
        }
    }
    Ok(())
}
