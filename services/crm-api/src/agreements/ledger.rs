//! Versioned state changes, redacted events and acceptance or decline evidence.
//! Events and actions are insert-only; neither stores terms, contacts or bodies.
use super::model::{Party, STALE};
use crate::error::{ApiError, ApiResult};
use sqlx::{Postgres, Transaction};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

/// One acceptance or decline of an exact revision.
pub struct Response<'a> {
    pub agreement: Uuid,
    pub revision: Uuid,
    pub action: &'a str,
    pub actor: Uuid,
    pub party: Party,
    pub accepted_digest: Option<&'a str>,
}

/// Advances one version from `expected`; a mismatch means the agreement changed.
pub async fn bump(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    expected: i64,
    state: &str,
    expires_at: Option<OffsetDateTime>,
    revision: Option<Uuid>,
) -> ApiResult<i64> {
    let stamp = match expires_at {
        Some(at) => Some(at.format(&Rfc3339).map_err(|_| ApiError::invalid(STALE))?),
        None => None,
    };
    sqlx::query_scalar(
        "UPDATE agreements.crm_agreements SET state=$2,
         current_revision_id=COALESCE($3,current_revision_id),
         expires_at=COALESCE($4::text::timestamptz,expires_at),
         version=version+1,updated_at=now()
         WHERE id=$1 AND version=$5 RETURNING version",
    )
    .bind(id)
    .bind(state)
    .bind(revision)
    .bind(stamp)
    .bind(expected)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(ApiError::stale(STALE))
}

pub async fn event(
    tx: &mut Transaction<'_, Postgres>,
    agreement: Uuid,
    revision: Option<Uuid>,
    action: &str,
    actor: Uuid,
    party: Party,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO agreements.crm_agreement_events
         (id,agreement_id,revision_id,action,actor_id,party) VALUES ($1,$2,$3,$4,$5,$6)",
    )
    .bind(Uuid::new_v4())
    .bind(agreement)
    .bind(revision)
    .bind(action)
    .bind(actor)
    .bind(party.as_str())
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Records the response with the member verification that A2 sessions provide.
pub async fn respond(tx: &mut Transaction<'_, Postgres>, response: &Response<'_>) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO agreements.crm_agreement_actions
         (id,agreement_id,revision_id,action,actor_id,party,verification,accepted_digest)
         VALUES ($1,$2,$3,$4,$5,$6,'member',$7)",
    )
    .bind(Uuid::new_v4())
    .bind(response.agreement)
    .bind(response.revision)
    .bind(response.action)
    .bind(response.actor)
    .bind(response.party.as_str())
    .bind(response.accepted_digest)
    .execute(&mut **tx)
    .await?;
    event(
        tx,
        response.agreement,
        Some(response.revision),
        response.action,
        response.actor,
        response.party,
    )
    .await
}
