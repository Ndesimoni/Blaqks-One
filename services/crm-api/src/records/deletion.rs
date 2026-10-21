use super::{audit, target, visibility::RecordScope};
use crate::{auth::grants::Action, error::ApiResult};
use sqlx::PgPool;
use uuid::Uuid;

/// Steps 4–7 and 10 of a delete (contract §4); the handler has run 1–3, including Delete.
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
    // Step 4 repeats the Delete check on the live profile (scope or grant may be gone).
    let user = crate::workspaces::ensure_writable(
        &mut transaction,
        workspace,
        actor,
        Some(collection),
        Some(Action::Delete),
    )
    .await?;
    let scope = RecordScope::of(&user);
    let found = target::fetch(&mut transaction, workspace, collection, id, scope).await?;
    target::ensure_version(
        &found,
        version,
        "This record changed. Reload before deleting.",
    )?;
    target::ensure_delete_allowed(scope, collection, &found)?;
    // Its photos and floor plans go with it (packet F2).
    crate::media::owned::remove(&mut transaction, super::media_links::KIND, found.id).await?;
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
