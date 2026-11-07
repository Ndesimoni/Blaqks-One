//! What every Blaqks One team route shares: the Owner-only gate, the organisation lock, the
//! position and access check and the locked target row.
use crate::{
    auth::{session, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::{
        self,
        platform::{areas, presets::Preset},
        ORGANISATION,
    },
};
use serde_json::Value;
use sqlx::{FromRow, Postgres, Transaction};
use std::collections::BTreeMap;
use uuid::Uuid;

pub(super) type Tx = Transaction<'static, Postgres>;

pub(super) const PRESET: &str = "Choose a position: manager, sales, support, analyst or custom.";

/// The session-level gate before any parsing: the Owner alone.
pub(super) fn owner_session(session: &Session) -> ApiResult<()> {
    if session.user.role != "super-admin" {
        return Err(ApiError::forbidden());
    }
    Ok(())
}

/// Opens the route's transaction and re-reads the live Owner inside it; writes first take
/// the organisation's lock. Returns the Owner's ID.
pub(super) async fn begin(
    state: &AppState,
    session: &Session,
    write: bool,
) -> ApiResult<(Tx, Uuid)> {
    owner_session(session)?;
    let mut tx = state.pool.begin().await?;
    if write {
        workspaces::lock(&mut tx, ORGANISATION).await?;
    }
    let owner = workspaces::platform::owner(&mut tx, session.user.id).await?;
    Ok((tx, owner.id))
}

/// A position and `{area: level}` access from a request, checked against the fixed table;
/// the access comes back in the stored shape.
pub(super) fn choice(
    preset: &str,
    access: &BTreeMap<String, String>,
) -> ApiResult<(Preset, Value)> {
    let preset = Preset::parse(preset).ok_or(ApiError::invalid(PRESET))?;
    let checked = areas::checked(access).map_err(ApiError::invalid)?;
    Ok((preset, serde_json::json!(areas::to_map(&checked))))
}

#[derive(FromRow)]
pub(super) struct Target {
    version: i64,
    pub accepted: bool,
    pub active: bool,
    pub email: String,
}

/// The named platform member of the Owner's organisation, not archived, locked for the
/// change, at the version the caller reviewed (when one is given). Anyone else (the Owner,
/// a company member, an unknown ID) is refused.
pub(super) async fn lock(
    tx: &mut Tx,
    owner: Uuid,
    id: &str,
    version: Option<i64>,
) -> ApiResult<(Uuid, Target)> {
    let id = Uuid::parse_str(id).map_err(|_| ApiError::invalid("Invalid member ID."))?;
    let target = sqlx::query_as::<_, Target>(
        "SELECT version,accepted_at IS NOT NULL AS accepted,active,email FROM crm_users \
         WHERE id=$1 AND role='platform' AND owner_id=$2 AND workspace_id=$3 \
         AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(owner)
    .bind(ORGANISATION)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(ApiError::forbidden)?;
    if version.is_some_and(|reviewed| reviewed != target.version) {
        return Err(ApiError::stale(
            "This person changed. Reload before saving.",
        ));
    }
    Ok((id, target))
}

/// Bumps the account version after a change, so the next edit must review it.
pub(super) async fn touch(tx: &mut Tx, id: Uuid) -> ApiResult<()> {
    sqlx::query("UPDATE crm_users SET version=version+1 WHERE id=$1")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// A fresh one-time activation link for `id` on their existing invitation row, valid for
/// 48 hours: a renewed invitation or an Owner-issued password reset. Returns the token for
/// the Owner to share and when it expires; only its digest is stored.
pub(super) async fn reissue(
    tx: &mut Tx,
    id: Uuid,
    owner: Uuid,
    actor: Uuid,
) -> ApiResult<(String, String)> {
    let token = session::random_token();
    let expires_at: String = sqlx::query_scalar(
        "UPDATE crm_team_invitations SET token_hash=$2,expires_at=now()+interval '48 hours', \
         consumed_at=NULL,revoked_at=NULL,created_by=$3 \
         WHERE user_id=$1 AND owner_id=$4 AND workspace_id=$5 \
         RETURNING to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')",
    )
    .bind(id)
    .bind(session::digest(&token))
    .bind(actor)
    .bind(owner)
    .bind(ORGANISATION)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(ApiError::forbidden)?;
    Ok((token, expires_at))
}
