//! Accepting and approving an in-company hand-over (design §14–§15). The receiving agent
//! accepts exactly the revision at the version they were shown. An Admin approval is
//! recorded as itself (`approved`, `admin_decision`), never as the agent's acceptance;
//! a changed referral share is first written as a new revision by the Admin, within
//! the same kind and the team's limit.
use super::{
    evidence::Place,
    handover::{expired, locked, CHANGED, EXPIRED},
    ledger::{self, Response},
    limits,
    model::{Kind, Party, State, INVALID, STALE},
    rows::{AgreementRow, RevisionRow},
    store,
    terms::{digest_of, BuiltTerms},
    write::{self, NewRevision},
};
use crate::error::{ApiError, ApiResult};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

pub const KIND_FIXED: &str = "Changing between a full hand-over and a referral needs a new offer.";

/// The hand-over being decided: its agreement at the version the decider saw, its two
/// members and the referral share finance holds for it.
pub struct Decide {
    pub agreement: Uuid,
    pub version: i64,
    pub actor: Uuid,
    pub members: (Uuid, Uuid),
    pub referral: Option<i32>,
}

async fn open(
    tx: &mut Transaction<'_, Postgres>,
    d: &Decide,
) -> ApiResult<(AgreementRow, RevisionRow)> {
    let row = locked(tx, d.agreement, d.members).await?;
    if row.state() != State::Sent {
        return Err(ApiError::conflict(CHANGED));
    }
    if row.version != d.version {
        return Err(ApiError::stale(STALE));
    }
    if expired(tx, d.agreement).await? {
        return Err(ApiError::conflict(EXPIRED));
    }
    let revision = store::current(tx, d.agreement).await?;
    let share = revision.terms["money"]["senderShareBp"].as_i64();
    let held = i64::from(d.referral.unwrap_or(0));
    if revision.author_party == "recipient" || share != Some(held) {
        return Err(ApiError::conflict(CHANGED));
    }
    Ok((row, revision))
}

/// The receiving agent accepts the exact offer.
pub async fn accept(tx: &mut Transaction<'_, Postgres>, d: &Decide) -> ApiResult<()> {
    let (row, revision) = open(tx, d).await?;
    ledger::bump(tx, d.agreement, row.version, "accepted", None, None).await?;
    let response = Response {
        agreement: d.agreement,
        revision: revision.id,
        action: "accepted",
        actor: d.actor,
        party: Party::Recipient,
        accepted_digest: Some(revision.digest.as_str()),
    };
    ledger::respond(tx, &response).await
}

/// The company Admin approves in place of the receiving agent, with `share` (which may
/// differ from the offer, within the same kind).
pub async fn approve(
    tx: &mut Transaction<'_, Postgres>,
    d: &Decide,
    share: Option<i32>,
) -> ApiResult<()> {
    let (row, offered) = open(tx, d).await?;
    if share.is_some() != d.referral.is_some() {
        return Err(ApiError::conflict(KIND_FIXED));
    }
    let (revision, digest) = if share == d.referral {
        (offered.id, offered.digest.clone())
    } else {
        adjusted(tx, &row, &offered, share.unwrap_or(0), d.actor).await?
    };
    let current = (revision != offered.id).then_some(revision);
    ledger::bump(tx, d.agreement, row.version, "accepted", None, current).await?;
    sqlx::query(
        "INSERT INTO agreements.crm_agreement_actions
         (id,agreement_id,revision_id,action,actor_id,party,verification,accepted_digest,
         created_at)
         VALUES ($1,$2,$3,'approved',$4,'recipient','admin_decision',$5,clock_timestamp())",
    )
    .bind(Uuid::new_v4())
    .bind(d.agreement)
    .bind(revision)
    .bind(d.actor)
    .bind(&digest)
    .execute(&mut **tx)
    .await?;
    ledger::event_by(tx, d.agreement, Some(revision), "approved", d.actor, None).await
}

/// The Admin's revision of the offer with a new referral share, within the team limit.
async fn adjusted(
    tx: &mut Transaction<'_, Postgres>,
    row: &AgreementRow,
    offered: &RevisionRow,
    share: i32,
    actor: Uuid,
) -> ApiResult<(Uuid, String)> {
    let (sender_bp, recipient_bp) = Kind::Referral.shares(i64::from(share))?;
    let cap = limits::referral_cap(tx, &row.workspace_id).await?;
    limits::check(Kind::Referral, sender_bp, cap)?;
    let mut value: Value = offered.terms.clone();
    if let Value::Object(map) = &mut value {
        map.remove("parties");
    }
    value["money"]["senderShareBp"] = json!(sender_bp);
    value["money"]["recipientShareBp"] = json!(recipient_bp);
    let expires_at = value["expiresAt"]
        .as_str()
        .and_then(|raw| OffsetDateTime::parse(raw, &Rfc3339).ok())
        .ok_or(ApiError::invalid(INVALID))?;
    let built = BuiltTerms {
        subject_digest: digest_of(&value["subject"]),
        value,
        expires_at,
    };
    let parties = row.parties();
    let revision = NewRevision {
        place: Place {
            agreement: row.id,
            number: offered.number + 1,
            parent: Some(offered.id),
        },
        parties: &parties,
        author: "admin",
        created_by: actor,
    };
    let (id, digest) = write::insert_revision(tx, revision, &built).await?;
    ledger::event_by(tx, row.id, Some(id), "adjusted", actor, None).await?;
    Ok((id, digest))
}
