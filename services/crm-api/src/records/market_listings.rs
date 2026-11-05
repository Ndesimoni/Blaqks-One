//! Marketplace's own-company inventory boundary: only held listings (or Admin's listings).
use crate::{auth::profile::UserRow, error::ApiResult};
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn held(
    tx: &mut Transaction<'_, Postgres>,
    user: &UserRow,
) -> ApiResult<Vec<(Uuid, Value)>> {
    if !user.can_collection("Properties") {
        return Ok(Vec::new());
    }
    Ok(sqlx::query_as("SELECT id,payload FROM crm_records WHERE workspace_id=$1 AND collection='Properties' AND ($2 OR assignee_id=$3) ORDER BY id LIMIT 1001")
        .bind(&user.workspace_id).bind(user.role=="admin").bind(user.id).fetch_all(&mut **tx).await?)
}
