//! Own-account response composition; company data is read only through tenancy.
use crate::{
    auth::profile::{Profile, UserRow},
    error::{ApiError, ApiResult},
    workspaces::company,
};
use serde_json::{json, Value};
use sqlx::{FromRow, PgConnection};
use uuid::Uuid;

#[derive(FromRow)]
struct AccountRow {
    #[sqlx(flatten)]
    user: UserRow,
    version: i64,
    password_changed_at: Option<String>,
    owner_name: String,
}

pub(in crate::auth::account) async fn load(
    connection: &mut PgConnection,
    user: Uuid,
) -> ApiResult<Value> {
    let row = sqlx::query_as::<_, AccountRow>(
        "SELECT u.*,to_char(c.password_changed_at AT TIME ZONE 'UTC', \
         'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS password_changed_at,o.name AS owner_name \
         FROM crm_user_profiles u JOIN crm_users c ON c.id=u.id \
         JOIN crm_user_profiles o ON o.id=COALESCE(u.owner_id,u.id) \
         WHERE u.id=$1 AND u.active AND u.owner_active",
    )
    .bind(user)
    .fetch_optional(&mut *connection)
    .await?
    .ok_or_else(ApiError::unauthorized)?;
    let workspace_id = row.user.workspace_id.clone();
    let company = company::get(&mut *connection, &workspace_id).await?;
    Ok(json!({
        "user": Profile::from(row.user),
        "version": row.version,
        "passwordChangedAt": row.password_changed_at,
        "team": {"workspaceId": workspace_id, "ownerName": row.owner_name},
        "company": company,
    }))
}
