//! Every revision and the redacted event log for the detail view (docs/agreements-design.md
//! §13). Agreements are evidence, so frozen terms and every offered revision stay visible.
//! A draft belongs to the sending company (§9): the receiving company sees only revisions
//! that were offered (sent or countered) and no draft-stage events.
use crate::error::ApiResult;
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

const STAMP: &str = "'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'";

#[derive(sqlx::FromRow)]
struct Revision {
    id: Uuid,
    number: i32,
    parent_number: Option<i32>,
    author_party: String,
    digest: String,
    terms: Value,
    created_at: String,
}

#[derive(sqlx::FromRow)]
struct Event {
    action: String,
    party: Option<String>,
    revision: Option<i32>,
    at: String,
}

/// Revisions oldest first. `sending` is true for the sending company.
pub async fn revisions(
    tx: &mut Transaction<'_, Postgres>,
    agreement: Uuid,
    sending: bool,
) -> ApiResult<Vec<Value>> {
    let rows = sqlx::query_as::<_, Revision>(&format!(
        "SELECT r.id, r.number, p.number AS parent_number, r.author_party, r.digest, r.terms,
         to_char(r.created_at AT TIME ZONE 'UTC',{STAMP}) AS created_at
         FROM agreements.crm_agreement_revisions r
         LEFT JOIN agreements.crm_agreement_revisions p ON p.id=r.parent_id
         WHERE r.agreement_id=$1 AND ($2 OR EXISTS (
             SELECT 1 FROM agreements.crm_agreement_events e
             WHERE e.revision_id=r.id AND e.action IN ('sent','countered')))
         ORDER BY r.number"
    ))
    .bind(agreement)
    .bind(sending)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| {
            json!({
                "id": row.id,
                "number": row.number,
                "parentNumber": row.parent_number,
                "authorParty": row.author_party,
                "digest": row.digest,
                "terms": row.terms,
                "createdAt": row.created_at,
            })
        })
        .collect())
}

/// Who did what and when, without actor IDs, terms or contact details.
pub async fn events(
    tx: &mut Transaction<'_, Postgres>,
    agreement: Uuid,
    sending: bool,
) -> ApiResult<Vec<Value>> {
    let rows = sqlx::query_as::<_, Event>(&format!(
        "SELECT e.action, e.party, r.number AS revision,
         to_char(e.created_at AT TIME ZONE 'UTC',{STAMP}) AS at
         FROM agreements.crm_agreement_events e
         LEFT JOIN agreements.crm_agreement_revisions r ON r.id=e.revision_id
         WHERE e.agreement_id=$1 AND ($2 OR e.action NOT IN ('created','revised'))
         ORDER BY e.created_at, e.id"
    ))
    .bind(agreement)
    .bind(sending)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| {
            json!({
                "action": row.action,
                "party": row.party,
                "revision": row.revision,
                "at": row.at,
            })
        })
        .collect())
}
