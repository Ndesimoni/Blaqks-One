//! Who an import is for (BO1a item 10, docs/blaqks-one-console.md §6): only a company's
//! live owning Admin imports, into their own workspace, never the organisation. A personal
//! source names the member who receives its parent records; the preview and the commit both
//! check that member under the workspace lock.
use super::model::ImportRecords;
use crate::{
    auth::{profile::UserRow, session::Session},
    error::{ApiError, ApiResult},
    records::visibility::PARENTS,
    state::AppState,
    team, workspaces,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const CHOOSE: &str = "Choose the member of your company who receives these records.";
pub const NOT_MEMBER: &str = "Choose an active member of your company to receive these records.";
pub const CANNOT_HOLD: &str =
    "That member's access doesn't include every record type in this import. Choose another member.";

/// Before anything else: the caller is an Admin opening their own company workspace.
pub async fn ensure_importer(
    state: &AppState,
    session: &Session,
    workspace: &str,
) -> ApiResult<()> {
    workspaces::ensure_access(state, session, workspace).await?;
    if session.user.role != "admin" {
        return Err(ApiError::forbidden());
    }
    Ok(())
}

/// Call under the workspace lock: the caller is still the live owning Admin.
pub async fn relock(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
) -> ApiResult<()> {
    if workspace == workspaces::ORGANISATION {
        return Err(ApiError::forbidden());
    }
    team::access::lock_exact_owner(tx, workspace, actor).await
}

/// Call under the workspace lock: `member` is a live, accepted Admin or staff member of
/// `workspace` who may hold every parent collection the import fills. Suspending or
/// archiving any member of this company takes the same lock, so the answer holds until
/// the caller commits.
pub async fn holder(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    member: Uuid,
    records: &ImportRecords,
) -> ApiResult<Uuid> {
    let live = sqlx::query_as::<_, UserRow>(
        "SELECT * FROM crm_user_profiles WHERE id=$1 AND workspace_id=$2 AND active \
         AND owner_active AND accepted_at IS NOT NULL AND role IN ('admin','staff')",
    )
    .bind(member)
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(ApiError::invalid(NOT_MEMBER))?;
    let refused = PARENTS
        .iter()
        .any(|collection| !records.rows(collection).is_empty() && !live.can_collection(collection));
    if refused {
        return Err(ApiError::invalid(CANNOT_HOLD));
    }
    Ok(live.id)
}
