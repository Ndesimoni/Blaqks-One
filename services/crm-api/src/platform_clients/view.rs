//! Reading clients for the API: the stored row with the names of the Blaqks One people
//! involved (from the published identity view) and the camelCase shapes the screen uses.
//! A linked company carries its ID and name only, from tenancy's `company_names`.
use super::input::Fields;
use crate::{error::ApiResult, workspaces::platform};
use serde_json::{json, Value};
use sqlx::{FromRow, Postgres, Transaction};
use std::collections::HashMap;
use uuid::Uuid;

pub(super) const SELECT: &str = "SELECT c.id,c.company_name,c.contact_name,c.phone,c.email, \
    c.source,c.stage,c.notes,to_char(c.next_follow_up,'YYYY-MM-DD') AS next_follow_up, \
    c.owner_id,o.name AS owner_name,c.linked_workspace_id,c.version, \
    to_char(c.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS updated_at, \
    to_char(c.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS cursor_at, \
    to_char(c.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS created_at, \
    b.name AS created_by_name \
    FROM platform_clients.crm_platform_clients c \
    LEFT JOIN crm_all_user_profiles o ON o.id=c.owner_id \
    LEFT JOIN crm_all_user_profiles b ON b.id=c.created_by";

#[derive(FromRow)]
pub(super) struct Row {
    pub id: Uuid,
    #[sqlx(flatten)]
    pub fields: Fields,
    pub owner_name: Option<String>,
    pub linked_workspace_id: Option<String>,
    pub version: i64,
    pub updated_at: String,
    /// `updated_at` to the microsecond, for the list's cursor.
    pub cursor_at: String,
    pub created_at: String,
    pub created_by_name: Option<String>,
}

/// One live (not archived) client, or 404.
pub(super) async fn one(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<Row> {
    sqlx::query_as::<_, Row>(&format!("{SELECT} WHERE c.id=$1 AND c.archived_at IS NULL"))
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(crate::error::ApiError::missing)
}

/// The names of the companies these clients are linked to, by workspace ID.
pub(super) async fn companies(
    tx: &mut Transaction<'_, Postgres>,
    rows: &[Row],
) -> ApiResult<HashMap<String, String>> {
    let mut ids: Vec<String> = rows
        .iter()
        .filter_map(|row| row.linked_workspace_id.clone())
        .collect();
    ids.sort();
    ids.dedup();
    if ids.is_empty() {
        return Ok(HashMap::new());
    }
    platform::company_names(tx, &ids).await
}

/// The list's shape: everything but the notes and the creation details.
pub(super) fn summary(row: &Row, companies: &HashMap<String, String>) -> Value {
    let fields = &row.fields;
    let linked = row
        .linked_workspace_id
        .as_ref()
        .map(|id| json!({"id": id, "name": companies.get(id)}));
    json!({
        "id": row.id,
        "companyName": fields.company_name,
        "contactName": fields.contact_name,
        "phone": fields.phone,
        "email": fields.email,
        "source": fields.source,
        "stage": fields.stage,
        "nextFollowUp": fields.next_follow_up,
        "ownerId": fields.owner_id,
        "ownerName": row.owner_name,
        "linkedCompany": linked,
        "updatedAt": row.updated_at,
        "version": row.version,
    })
}

/// One client in full: the list's fields with the notes and who added it when.
pub(super) fn detail(row: &Row, companies: &HashMap<String, String>) -> Value {
    let mut value = summary(row, companies);
    value["notes"] = json!(row.fields.notes);
    value["createdAt"] = json!(row.created_at);
    value["createdByName"] = json!(row.created_by_name);
    value
}

/// One client read back in full, as the create and edit routes answer.
pub(super) async fn full(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<Value> {
    let row = one(tx, id).await?;
    let companies = companies(tx, std::slice::from_ref(&row)).await?;
    Ok(detail(&row, &companies))
}
