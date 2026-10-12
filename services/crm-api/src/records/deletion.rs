use super::audit;
use crate::error::{ApiError, ApiResult};
use sqlx::PgPool;
use uuid::Uuid;

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
    crate::workspaces::ensure_writable(&mut transaction, workspace, actor, Some(collection))
        .await?;
    let deleted = sqlx::query(
        "DELETE FROM crm_records WHERE id=$1 AND workspace_id=$2 AND collection=$3 AND version=$4",
    )
    .bind(id)
    .bind(workspace)
    .bind(collection)
    .bind(version)
    .execute(&mut *transaction)
    .await?;
    if deleted.rows_affected() == 0 {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM crm_records WHERE id=$1 AND workspace_id=$2 AND collection=$3)",
        ).bind(id).bind(workspace).bind(collection).fetch_one(&mut *transaction).await?;
        return Err(if exists {
            ApiError::stale("This record changed. Reload before deleting.")
        } else {
            ApiError::missing()
        });
    }
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
