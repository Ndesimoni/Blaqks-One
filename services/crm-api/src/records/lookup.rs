//! Record lookups other modules call instead of reading `crm_records` (decision D7): exact
//! contact matching, a visibility-checked summary, and the holder of a listing. None of
//! them returns payload fields beyond what its caller is allowed to show.
use super::visibility::{predicate, RecordScope};
use crate::{auth::profile::UserRow, error::ApiResult};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

/// The international digits of a stored phone value: a `00` prefix is dropped, and a
/// single leading `0` or a bare 9-digit national number takes the UAE code (design §6).
const PHONE: &str = "(CASE WHEN x.d LIKE '00%' THEN substr(x.d,3) \
    WHEN x.d LIKE '0%' THEN '971'||substr(x.d,2) \
    WHEN length(x.d)=9 THEN '971'||x.d ELSE x.d END)";

/// A Client or Contact whose phone or email matches exactly. No names or values.
#[derive(Clone, Debug, FromRow, PartialEq)]
pub struct Candidate {
    pub collection: String,
    pub record_id: Uuid,
    pub assignee_id: Option<Uuid>,
}

/// Exact matches in one workspace for international phone digits (no `+`) or a
/// lower-case email. Several candidates mean a person must choose; names never merge.
pub async fn contact_matches(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    phone_digits: Option<&str>,
    email: Option<&str>,
) -> ApiResult<Vec<Candidate>> {
    let sql = format!(
        "SELECT x.collection,x.id AS record_id,x.assignee_id FROM ( \
           SELECT r.collection,r.id,r.assignee_id, \
             regexp_replace(coalesce(r.payload->>'phone',''),'[^0-9]','','g') AS d, \
             lower(btrim(coalesce(r.payload->>'email',''))) AS e \
           FROM crm_records r \
           WHERE r.workspace_id=$1 AND r.collection IN ('Clients','Contacts')) x \
         WHERE ($2::text IS NOT NULL AND length(x.d)>=8 AND {PHONE}=$2) \
            OR ($3::text IS NOT NULL AND x.e<>'' AND x.e=$3) \
         ORDER BY x.collection,x.id LIMIT 10"
    );
    sqlx::query_as(&sql)
        .bind(workspace)
        .bind(phone_digits)
        .bind(email)
        .fetch_all(&mut **transaction)
        .await
        .map_err(Into::into)
}

/// What a viewer may see of a linked record: its ID and display name, only when the
/// record exists, its collection is granted and the record scope allows it.
#[derive(Clone, Debug, FromRow, PartialEq)]
pub struct Summary {
    pub legacy_id: String,
    pub name: Option<String>,
}

pub async fn summary(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    viewer: &UserRow,
    collection: &str,
    record: Uuid,
) -> ApiResult<Option<Summary>> {
    if !viewer.can_collection(collection) {
        return Ok(None);
    }
    let sql = format!(
        "SELECT r.legacy_id,r.payload->>'full_name' AS name FROM crm_records r \
         WHERE r.workspace_id=$1 AND r.collection=$2 AND r.id=$3 AND {}",
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

/// The agent holding the Property with this record ID, for routing a listing enquiry.
pub async fn property_holder(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    property_id: &str,
) -> ApiResult<Option<Uuid>> {
    let holder: Option<Option<Uuid>> = sqlx::query_scalar(
        "SELECT assignee_id FROM crm_records \
         WHERE workspace_id=$1 AND collection='Properties' AND legacy_id=$2",
    )
    .bind(workspace)
    .bind(property_id)
    .fetch_optional(&mut **transaction)
    .await?;
    Ok(holder.flatten())
}

/// Records in one collection, for other modules' database tests.
#[cfg(test)]
pub async fn count_for_tests(pool: &sqlx::PgPool, workspace: &str, collection: &str) -> i64 {
    sqlx::query_scalar("SELECT count(*) FROM crm_records WHERE workspace_id=$1 AND collection=$2")
        .bind(workspace)
        .bind(collection)
        .fetch_one(pool)
        .await
        .unwrap()
}
