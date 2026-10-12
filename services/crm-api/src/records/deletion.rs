use super::{audit, target, visibility::RecordScope};
use crate::error::ApiResult;
use sqlx::PgPool;
use uuid::Uuid;

/// Steps 4–6 and 10 of a delete (contract §4); the handler has run 1–3, including H2.
pub async fn delete(
    pool: &PgPool,
    actor: Uuid,
    workspace: &str,
    collection: &str,
    id: Uuid,
    version: i64,
) -> ApiResult<()> {
    let mut transaction = pool.begin().await?;
    crate::workspaces::lock(&mut transaction, workspace).await?;
    let user =
        crate::workspaces::ensure_writable(&mut transaction, workspace, actor, Some(collection))
            .await?;
    let scope = RecordScope::of(&user);
    // The live profile may have lost the full-team grant since step 3.
    scope.ensure_can_delete(collection)?;
    let found = target::fetch(&mut transaction, workspace, collection, id, scope).await?;
    target::ensure_version(
        &found,
        version,
        "This record changed. Reload before deleting.",
    )?;
    sqlx::query("DELETE FROM crm_records WHERE id=$1")
        .bind(found.id)
        .execute(&mut *transaction)
        .await?;
    audit::append(
        &mut transaction,
        actor,
        workspace,
        "deleted",
        collection,
        id,
    )
    .await?;
    transaction.commit().await?;
    Ok(())
}
