//! The certificate's stable evidence block (docs/agreements-a3b.md, design §14 A3b): every
//! offered revision with its full stored terms and digest, every decision with its
//! verification, the event history and the payment entries, each in a fixed order. Both
//! companies get the same revisions: draft-stage revisions and events never appear. No
//! names (the display block has them), no deal or hand-over IDs, no message bodies.
use super::rows::AgreementRow;
use crate::error::ApiResult;
use serde_json::{json, Value};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

const STAMP: &str = "'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'";
/// A revision is offered once it was sent, countered, proposed as an amendment or written
/// by an Admin on an in-company hand-over.
const OFFERED: &str = "EXISTS (SELECT 1 FROM agreements.crm_agreement_events o \
    WHERE o.revision_id=r.id AND o.action IN ('sent','countered','amendment_proposed','adjusted'))";

#[derive(FromRow)]
struct Revision {
    id: Uuid,
    number: i32,
    parent_id: Option<Uuid>,
    author_party: String,
    digest_scheme: i16,
    digest: String,
    terms: Value,
    created_at: String,
}

#[derive(FromRow)]
struct Action {
    id: Uuid,
    action: String,
    revision: i32,
    party: String,
    actor_id: Uuid,
    verification: String,
    accepted_digest: Option<String>,
    created_at: String,
}

#[derive(FromRow)]
struct Event {
    action: String,
    revision: Option<i32>,
    party: Option<String>,
    actor_id: Option<Uuid>,
    at: String,
}

#[derive(FromRow)]
struct Payment {
    id: Uuid,
    action: String,
    reference_id: Option<Uuid>,
    amount_fils: i64,
    paid_on: String,
    party: String,
    actor_id: Uuid,
    at: String,
}

pub struct Evidence {
    pub value: Value,
    /// Everyone the evidence names, for the display block.
    pub actors: Vec<Uuid>,
}

/// The evidence block of `row`, which the caller may read and which was offered.
pub async fn build(tx: &mut Tx<'_>, row: &AgreementRow) -> ApiResult<Evidence> {
    let at = |column: &str| format!("to_char({column} AT TIME ZONE 'UTC',{STAMP})");
    let revisions_sql = format!(
        "SELECT r.id,r.number,r.parent_id,r.author_party,r.digest_scheme,r.digest,r.terms, \
         {} AS created_at FROM agreements.crm_agreement_revisions r \
         WHERE r.agreement_id=$1 AND {OFFERED} ORDER BY r.number,r.id",
        at("r.created_at")
    );
    let actions_sql = format!(
        "SELECT x.id,x.action,r.number AS revision,x.party,x.actor_id,x.verification, \
         x.accepted_digest,{} AS created_at FROM agreements.crm_agreement_actions x \
         JOIN agreements.crm_agreement_revisions r ON r.id=x.revision_id \
         WHERE x.agreement_id=$1 ORDER BY x.created_at,x.id",
        at("x.created_at")
    );
    let events_sql = format!(
        "SELECT e.action,r.number AS revision,e.party,e.actor_id,{} AS at \
         FROM agreements.crm_agreement_events e \
         LEFT JOIN agreements.crm_agreement_revisions r ON r.id=e.revision_id \
         WHERE e.agreement_id=$1 AND e.action NOT IN ('created','revised') \
         ORDER BY e.created_at,e.id",
        at("e.created_at")
    );
    let payments_sql = format!(
        "SELECT p.id,p.action,p.reference_id,p.amount_fils,to_char(p.paid_on,'YYYY-MM-DD') \
         AS paid_on,p.party,p.actor_id,{} AS at FROM agreements.crm_agreement_payments p \
         WHERE p.agreement_id=$1 ORDER BY p.created_at,p.id",
        at("p.created_at")
    );
    let revisions = sqlx::query_as::<_, Revision>(&revisions_sql)
        .bind(row.id)
        .fetch_all(&mut **tx)
        .await?;
    let actions = sqlx::query_as::<_, Action>(&actions_sql)
        .bind(row.id)
        .fetch_all(&mut **tx)
        .await?;
    let events = sqlx::query_as::<_, Event>(&events_sql)
        .bind(row.id)
        .fetch_all(&mut **tx)
        .await?;
    let payments = sqlx::query_as::<_, Payment>(&payments_sql)
        .bind(row.id)
        .fetch_all(&mut **tx)
        .await?;
    let mut actors = vec![row.sender_member_id, row.recipient_member_id];
    actors.extend(actions.iter().map(|action| action.actor_id));
    actors.extend(events.iter().filter_map(|event| event.actor_id));
    actors.extend(payments.iter().map(|payment| payment.actor_id));
    actors.sort();
    actors.dedup();
    let value = json!({
        "format": "agreement-evidence", "formatVersion": 1,
        "agreement": {"id": row.id, "kind": row.kind, "origin": row.origin, "state": row.state,
            "currentRevisionId": row.current_revision_id,
            "proposedRevisionId": row.proposed_revision_id},
        "revisions": revisions.iter().map(|r| json!({"id": r.id, "number": r.number,
            "parentId": r.parent_id, "authorParty": r.author_party,
            "digestScheme": r.digest_scheme, "digest": r.digest, "terms": r.terms,
            "createdAt": r.created_at})).collect::<Vec<_>>(),
        "actions": actions.iter().map(|x| json!({"id": x.id, "action": x.action,
            "revision": x.revision, "party": x.party, "actorId": x.actor_id,
            "verification": x.verification, "acceptedDigest": x.accepted_digest,
            "createdAt": x.created_at})).collect::<Vec<_>>(),
        "events": events.iter().map(|e| json!({"action": e.action, "revision": e.revision,
            "party": e.party, "actorId": e.actor_id, "at": e.at})).collect::<Vec<_>>(),
        "payments": payments.iter().map(|p| json!({"id": p.id, "action": p.action,
            "referenceId": p.reference_id, "amountFils": p.amount_fils, "paidOn": p.paid_on,
            "party": p.party, "actorId": p.actor_id, "at": p.at})).collect::<Vec<_>>(),
    });
    Ok(Evidence { value, actors })
}
