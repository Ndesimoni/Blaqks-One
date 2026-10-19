//! Mailbox-verified release of an abandoned invitation. The identity UUID remains so
//! immutable team history stays valid; only its PII is replaced with a tombstone.
use crate::{auth::invitation_identity, error::ApiResult, workspaces};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

#[derive(Clone, Copy, Eq, PartialEq)]
pub enum State {
    Live,
    Releasable,
    Unavailable,
}

pub async fn state(pool: &PgPool, user: Uuid) -> ApiResult<State> {
    let row: Option<(bool, bool)> = sqlx::query_as(
        "SELECT expires_at>now() AND consumed_at IS NULL AND revoked_at IS NULL, \
         consumed_at IS NULL AND (revoked_at IS NOT NULL OR expires_at<=now()) \
         FROM crm_team_invitations WHERE user_id=$1",
    )
    .bind(user)
    .fetch_optional(pool)
    .await?;
    Ok(match row {
        Some((true, _)) => State::Live,
        Some((_, true)) => State::Releasable,
        _ => State::Unavailable,
    })
}

/// Call after proving mailbox ownership and taking the per-email advisory lock.
pub async fn release(
    transaction: &mut Transaction<'_, Postgres>,
    user: Uuid,
    email: &str,
) -> ApiResult<bool> {
    let scope: Option<(String, String)> = sqlx::query_as(
        "SELECT i.workspace_id,CASE WHEN u.role='admin' THEN u.id::text ELSE i.workspace_id END \
         FROM crm_team_invitations i JOIN crm_users u ON u.id=i.user_id WHERE i.user_id=$1",
    )
    .bind(user)
    .fetch_optional(&mut **transaction)
    .await?;
    let Some((workspace, target_workspace)) = scope else {
        return Ok(false);
    };
    let mut workspace_ids = vec![&workspace, &target_workspace];
    workspace_ids.sort_unstable();
    workspace_ids.dedup();
    for workspace_id in workspace_ids {
        workspaces::lock(transaction, workspace_id).await?;
    }
    let eligible: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM crm_users u JOIN crm_team_invitations i ON i.user_id=u.id \
         WHERE u.id=$1 AND u.email=$2 AND u.role IN ('staff','admin') AND NOT u.active \
         AND u.accepted_at IS NULL AND u.deleted_at IS NULL AND u.password_hash='' \
         AND i.workspace_id=$3 AND i.consumed_at IS NULL \
         AND (i.revoked_at IS NOT NULL OR i.expires_at<=now()) FOR UPDATE OF u,i)",
    )
    .bind(user)
    .bind(email)
    .bind(&workspace)
    .fetch_one(&mut **transaction)
    .await?;
    if !eligible {
        return Ok(false);
    }
    sqlx::query(
        "UPDATE crm_team_invitations SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1",
    )
    .bind(user)
    .execute(&mut **transaction)
    .await?;
    invitation_identity::tombstone(transaction, user, email).await
}
