//! The Admin's revision of an in-company referral (design §14 A3a): approving in place of
//! the receiving agent with a different referral share first writes that share as a new
//! revision by the Admin, within the same kind and the team's limit. Never after an
//! acceptance (H2 amendment 5).
use super::{
    evidence::Place,
    ledger, limits,
    model::{Kind, INVALID},
    rows::{AgreementRow, RevisionRow},
    terms::{digest_of, BuiltTerms},
    write::{self, NewRevision},
};
use crate::error::{ApiError, ApiResult};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

/// The Admin's revision of the offer with a new referral share, within the team limit.
pub(super) async fn adjusted(
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
