//! Agreement writes: drafts and sealed revisions. State changes and evidence rows
//! are in `ledger.rs`; revisions are insert-only.
use super::{
    evidence::{self, Parties, Place},
    ledger::event,
    model::Party,
    terms::BuiltTerms,
};
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// A new revision of an existing agreement, written by `author`: `sender`, `recipient`
/// or, on an in-company hand-over, `admin`.
pub struct NewRevision<'a> {
    pub place: Place,
    pub parties: &'a Parties,
    pub author: &'static str,
    pub created_by: Uuid,
}

/// A draft; `origin` is `direct`, or `deal_handover` when finance records a hand-over.
pub async fn insert_draft(
    tx: &mut Transaction<'_, Postgres>,
    parties: &Parties,
    (kind, origin): (&str, &str),
    created_by: Uuid,
    terms: &BuiltTerms,
) -> ApiResult<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO agreements.crm_agreements
         (id,workspace_id,recipient_workspace_id,kind,origin,state,version,created_by)
         VALUES ($1,$2,$3,$4,$5,'draft',1,$6)",
    )
    .bind(id)
    .bind(&parties.sender_workspace)
    .bind(&parties.recipient_workspace)
    .bind(kind)
    .bind(origin)
    .bind(created_by)
    .execute(&mut **tx)
    .await?;
    sqlx::query(
        "INSERT INTO agreements.crm_agreement_participants (agreement_id,party,workspace_id,member_id)
         VALUES ($1,'sender',$2,$3),($1,'recipient',$4,$5)",
    )
    .bind(id)
    .bind(&parties.sender_workspace)
    .bind(parties.sender_member)
    .bind(&parties.recipient_workspace)
    .bind(parties.recipient_member)
    .execute(&mut **tx)
    .await?;
    let place = Place {
        agreement: id,
        number: 1,
        parent: None,
    };
    let first = NewRevision {
        place,
        parties,
        author: Party::Sender.as_str(),
        created_by,
    };
    let (revision, _) = insert_revision(tx, first, terms).await?;
    sqlx::query("UPDATE agreements.crm_agreements SET current_revision_id=$2 WHERE id=$1")
        .bind(id)
        .bind(revision)
        .execute(&mut **tx)
        .await?;
    event(tx, id, Some(revision), "created", created_by, Party::Sender).await?;
    Ok(id)
}

/// Seals and stores a revision; returns its ID and evidence digest.
pub async fn insert_revision(
    tx: &mut Transaction<'_, Postgres>,
    revision: NewRevision<'_>,
    terms: &BuiltTerms,
) -> ApiResult<(Uuid, String)> {
    let id = Uuid::new_v4();
    let sealed = evidence::seal(terms, revision.parties, &revision.place, revision.author);
    sqlx::query(
        "INSERT INTO agreements.crm_agreement_revisions (id,agreement_id,number,parent_id,
         author_party,terms,subject_digest,digest,created_by,digest_scheme)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,2)",
    )
    .bind(id)
    .bind(revision.place.agreement)
    .bind(revision.place.number)
    .bind(revision.place.parent)
    .bind(revision.author)
    .bind(&sealed.terms)
    .bind(&terms.subject_digest)
    .bind(&sealed.digest)
    .bind(revision.created_by)
    .execute(&mut **tx)
    .await?;
    Ok((id, sealed.digest))
}
