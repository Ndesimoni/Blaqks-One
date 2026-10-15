//! Immutable account history (`crm_account_events`, migration 0018). An event names the
//! account, the actor, the workspace and the action only: never field values, passwords,
//! tokens, IP addresses or User-Agents.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

#[derive(Clone, Copy)]
pub enum Action {
    ProfileUpdated,
    PasswordChanged,
    SessionsRevoked,
    SessionRevoked,
}

impl Action {
    fn name(self) -> &'static str {
        match self {
            Self::ProfileUpdated => "profile_updated",
            Self::PasswordChanged => "password_changed",
            Self::SessionsRevoked => "sessions_revoked",
            Self::SessionRevoked => "session_revoked",
        }
    }
}

/// Records a self-service `action` inside the mutation's transaction. Self-service always
/// has the account as its own actor; the columns stay separate for Admin-issued resets.
pub async fn append(
    transaction: &mut Transaction<'_, Postgres>,
    user: Uuid,
    actor: Uuid,
    workspace: &str,
    action: Action,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO crm_account_events (user_id,actor_id,workspace_id,action) \
         VALUES ($1,$2,$3,$4)",
    )
    .bind(user)
    .bind(actor)
    .bind(workspace)
    .bind(action.name())
    .execute(&mut **transaction)
    .await?;
    Ok(())
}
