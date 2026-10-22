//! Agreement reads. The module owns `agreements.crm_*`; identity membership is read
//! through the published profile view (service-boundaries rule 3).
use super::rows::{AgreementRow, RevisionRow};
use crate::error::{ApiError, ApiResult};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const NOT_MEMBER: &str = "Choose an active member of the receiving company.";
pub const SAME_COMPANY: &str = "Choose a member of another company.";

const SELECT: &str =
    "SELECT a.id,a.workspace_id,a.recipient_workspace_id,a.kind,a.origin,a.state,a.version,
    a.current_revision_id,
    to_char(a.expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS expires_at,
    to_char(a.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at,
    to_char(a.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS updated_at,
    (a.expires_at IS NOT NULL AND a.expires_at <= clock_timestamp()) AS expired,
    s.member_id AS sender_member_id, r.member_id AS recipient_member_id
    FROM agreements.crm_agreements a
    JOIN agreements.crm_agreement_participants s ON s.agreement_id=a.id AND s.party='sender'
    JOIN agreements.crm_agreement_participants r ON r.agreement_id=a.id AND r.party='recipient'";

/// A2 agreements are cross-company: the recipient must be an active member of a live
/// customer company other than the sender's. The Super Admin cannot be named.
pub async fn ensure_recipient(
    tx: &mut Transaction<'_, Postgres>,
    sender_workspace: &str,
    workspace: &str,
    member: Uuid,
) -> ApiResult<()> {
    if workspace == sender_workspace {
        return Err(ApiError::invalid(SAME_COMPANY));
    }
    let found: Option<String> = sqlx::query_scalar(
        "SELECT workspace_id FROM crm_user_profiles \
         WHERE id=$1 AND active AND owner_active AND role<>'super-admin'",
    )
    .bind(member)
    .fetch_optional(&mut **tx)
    .await?;
    match found.as_deref() {
        Some(actual) if actual == workspace => Ok(()),
        _ => Err(ApiError::invalid(NOT_MEMBER)),
    }
}

pub async fn load(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<Option<AgreementRow>> {
    sqlx::query_as::<_, AgreementRow>(&format!("{SELECT} WHERE a.id=$1"))
        .bind(id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(Into::into)
}

/// Locks the agreement row. The two parties take different workspace locks, so this
/// row lock is what serialises a sender's and a recipient's commands.
pub async fn load_locked(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> ApiResult<Option<AgreementRow>> {
    sqlx::query_as::<_, AgreementRow>(&format!("{SELECT} WHERE a.id=$1 FOR UPDATE OF a"))
        .bind(id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(Into::into)
}

/// The caller's company agreements. Drafts stay with the sending company until sent.
pub async fn list(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    member: Uuid,
    admin: bool,
) -> ApiResult<Vec<AgreementRow>> {
    sqlx::query_as::<_, AgreementRow>(&format!(
        "{SELECT} WHERE (a.workspace_id=$1 OR (a.recipient_workspace_id=$1 AND a.state<>'draft')) \
         AND ($2 OR s.member_id=$3 OR r.member_id=$3) AND a.archived_at IS NULL \
         ORDER BY a.updated_at DESC, a.id"
    ))
    .bind(workspace)
    .bind(admin)
    .bind(member)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}

/// The revision in force (or on offer): always `current_revision_id`, never simply the
/// highest number, so a later proposal never stands in for accepted terms.
pub async fn current(
    tx: &mut Transaction<'_, Postgres>,
    agreement: Uuid,
) -> ApiResult<RevisionRow> {
    sqlx::query_as::<_, RevisionRow>(
        "SELECT r.id,r.number,r.author_party,r.digest,r.terms
         FROM agreements.crm_agreement_revisions r
         JOIN agreements.crm_agreements a ON a.current_revision_id=r.id WHERE a.id=$1",
    )
    .bind(agreement)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(ApiError::missing)
}
