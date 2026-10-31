//! The email recipient of a Client or Contact, for the Inbox's Start message (E1b, decision
//! D7: other modules call records functions, never `crm_records`). Only the name and the
//! stored address, and only when the viewer may see that record.
use super::visibility::{predicate, RecordScope};
use crate::{auth::profile::UserRow, error::ApiResult};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

#[derive(Clone, Debug, FromRow, PartialEq)]
pub struct Recipient {
    pub name: Option<String>,
    pub email: Option<String>,
}

pub async fn recipient(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    viewer: &UserRow,
    collection: &str,
    record: Uuid,
) -> ApiResult<Option<Recipient>> {
    if !matches!(collection, "Clients" | "Contacts") || !viewer.can_collection(collection) {
        return Ok(None);
    }
    let sql = format!(
        "SELECT r.payload->>'full_name' AS name,btrim(r.payload->>'email') AS email \
         FROM crm_records r WHERE r.workspace_id=$1 AND r.collection=$2 AND r.id=$3 AND {}",
        predicate("r", "$1", "$4")
    );
    sqlx::query_as(&sql)
        .bind(workspace)
        .bind(collection)
        .bind(record)
        .bind(RecordScope::of(viewer).caller())
        .fetch_optional(&mut **transaction)
        .await
        .map_err(Into::into)
}
