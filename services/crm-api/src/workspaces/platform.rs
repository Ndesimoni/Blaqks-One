//! The platform's company workspaces for the Super Admin's Workspaces list (design queue item
//! 33): each company with its name, Admin, whether it is active or archived and when it was
//! created. The team module adds seats and the marketplace state (team/platform.rs).
use super::ORGANISATION;
use crate::error::ApiResult;
use sqlx::{FromRow, PgPool};

#[derive(FromRow)]
pub struct CompanyRow {
    pub id: String,
    pub name: String,
    pub admin: String,
    pub status: String,
    pub created_on: String,
}

/// Every company workspace (never the platform's own), oldest first.
pub async fn company_rows(pool: &PgPool) -> ApiResult<Vec<CompanyRow>> {
    sqlx::query_as::<_, CompanyRow>(
        "SELECT w.id, COALESCE(c.display_name,u.name) AS name, u.name AS admin, \
         CASE WHEN u.deleted_at IS NOT NULL THEN 'archived' \
         WHEN u.active THEN 'active' ELSE 'inactive' END AS status, \
         to_char(w.created_at AT TIME ZONE 'Asia/Dubai','YYYY-MM-DD') AS created_on \
         FROM crm_workspaces w JOIN crm_users u ON u.id=w.owner_id \
         LEFT JOIN crm_company_profiles c ON c.workspace_id=w.id \
         WHERE w.id<>$1 AND u.role='admin' ORDER BY w.created_at,w.id",
    )
    .bind(ORGANISATION)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}
