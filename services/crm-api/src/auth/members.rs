//! Live identity reads for other modules (service boundaries rule 3, the published identity
//! views). The marketplace asks who a member is and whether they are live, without joining
//! `crm_user_profiles` itself.
use crate::error::ApiResult;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow)]
pub struct LiveMember {
    pub id: Uuid,
    pub workspace_id: String,
    pub name: String,
}

/// An active member whose company owner is active; the Super Admin is never included.
pub async fn live<'e>(
    executor: impl sqlx::PgExecutor<'e>,
    id: Uuid,
) -> ApiResult<Option<LiveMember>> {
    Ok(sqlx::query_as(
        "SELECT id,workspace_id,name FROM crm_user_profiles \
         WHERE id=$1 AND active AND owner_active AND role<>'super-admin'",
    )
    .bind(id)
    .fetch_optional(executor)
    .await?)
}

/// The member's name in that company, only when they are live there.
pub async fn live_name<'e>(
    executor: impl sqlx::PgExecutor<'e>,
    workspace: &str,
    id: Uuid,
) -> ApiResult<Option<String>> {
    Ok(sqlx::query_scalar(
        "SELECT name FROM crm_user_profiles \
         WHERE id=$1 AND workspace_id=$2 AND active AND owner_active AND role<>'super-admin'",
    )
    .bind(id)
    .bind(workspace)
    .fetch_optional(executor)
    .await?)
}
