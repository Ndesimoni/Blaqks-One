use crate::{auth::session::digest, error::ApiResult};
use serde_json::{json, Value};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

#[derive(FromRow)]
pub struct TargetRow {
    pub id: Uuid,
    pub version: i64,
    pub collection: String,
    pub legacy_id: String,
    pub payload: Value,
}

pub async fn read(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
) -> ApiResult<Vec<TargetRow>> {
    Ok(sqlx::query_as::<_, TargetRow>(
        "SELECT id,version,collection,legacy_id,payload FROM crm_records WHERE workspace_id=$1 \
         ORDER BY collection,legacy_id,id",
    )
    .bind(workspace)
    .fetch_all(&mut **transaction)
    .await?)
}

pub fn fingerprint(rows: &[TargetRow]) -> String {
    let values: Vec<Value> = rows
        .iter()
        .map(|row| {
            json!({"id":row.id,"version":row.version,
        "collection":row.collection,"legacyId":row.legacy_id})
        })
        .collect();
    digest(&Value::Array(values).to_string())
}
