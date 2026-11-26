//! Who may share a record and who may receive it (docs/record-sharing.md R1, amendments 1
//! and 2). Only the holder or the company Admin shares, never from a keep or through
//! another record; the receiver is assigned-only staff of the company who may hold the
//! type and cannot already see the record.
use crate::{
    assignments::eligibility,
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
    records::{lookup, visibility::predicate},
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

pub const COLLECTIONS: [&str; 3] = ["Clients", "Properties", "Contacts"];
pub const SENDER: &str = "Only the record's holder or your Admin can share it.";
pub const RECEIVER: &str = "This colleague can't receive this record.";

/// The record being shared: its ID and current holder.
#[derive(Clone, Copy, Debug)]
pub struct Target {
    pub id: Uuid,
    pub holder: Option<Uuid>,
}

/// Locks and re-reads the share's record after its share row has been locked.
pub async fn target(
    tx: &mut Tx<'_>,
    workspace: &str,
    collection: &str,
    id: Uuid,
) -> ApiResult<Target> {
    let holder = sqlx::query_scalar(
        "SELECT assignee_id FROM crm_records WHERE id=$1 AND workspace_id=$2 \
         AND collection=$3 FOR SHARE",
    )
    .bind(id)
    .bind(workspace)
    .bind(collection)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(ApiError::missing)?;
    Ok(Target { id, holder })
}

/// The record `id` of `collection`, locked `FOR SHARE`, when `live` may share it: 403 when
/// they see it but neither hold it nor are the Admin, the usual 404 otherwise.
pub async fn shareable(
    tx: &mut Tx<'_>,
    workspace: &str,
    live: &UserRow,
    (collection, id): (&str, Uuid),
) -> ApiResult<Target> {
    if !COLLECTIONS.contains(&collection) {
        return Err(ApiError::missing());
    }
    let found: Option<Option<Uuid>> = sqlx::query_scalar(
        "SELECT assignee_id FROM crm_records WHERE id=$1 AND workspace_id=$2 \
         AND collection=$3 FOR SHARE",
    )
    .bind(id)
    .bind(workspace)
    .bind(collection)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(holder) = found else {
        return Err(ApiError::missing());
    };
    let admin = live.role == "admin" && live.workspace_id == workspace;
    if live.can_collection(collection) && (admin || holder == Some(live.id)) {
        return Ok(Target { id, holder });
    }
    let sees = lookup::visible(tx, workspace, live, collection, &[id]).await?;
    Err(match sees.is_empty() {
        true => ApiError::missing(),
        false => ApiError::denied(SENDER),
    })
}

/// Whether `to` may receive `target` from `sender` now. Locks the member row `FOR SHARE`.
pub async fn receivable(
    tx: &mut Tx<'_>,
    workspace: &str,
    (collection, target): (&str, Target),
    (sender, to): (Uuid, Uuid),
) -> ApiResult<bool> {
    if to == sender || target.holder == Some(to) {
        return Ok(false);
    }
    if !eligibility::can_hold(tx, workspace, collection, to).await? {
        return Ok(false);
    }
    let member: Option<UserRow> = sqlx::query_as(
        "SELECT * FROM crm_user_profiles WHERE id=$1 AND workspace_id=$2 AND active \
         AND owner_active",
    )
    .bind(to)
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?;
    if !member.is_some_and(|member| member.role == "staff" && !member.has_team_scope()) {
        return Ok(false);
    }
    let sql = format!(
        "SELECT EXISTS(SELECT 1 FROM crm_record_keeps WHERE record_id=$3 AND member_id=$2) \
         OR EXISTS(SELECT 1 FROM crm_records r WHERE r.id=$3 AND r.workspace_id=$1 AND {})",
        predicate("r", "$1", "$2")
    );
    let already: bool = sqlx::query_scalar(&sql)
        .bind(workspace)
        .bind(to)
        .bind(target.id)
        .fetch_one(&mut **tx)
        .await?;
    Ok(!already)
}

/// Whether the sender may still share the record: they hold it or are its company's Admin.
pub async fn sender_still(
    tx: &mut Tx<'_>,
    workspace: &str,
    target: Target,
    sender: Uuid,
) -> ApiResult<bool> {
    if target.holder == Some(sender) {
        return Ok(true);
    }
    sqlx::query("SELECT 1 FROM crm_users WHERE id=$1 FOR SHARE")
        .bind(sender)
        .fetch_optional(&mut **tx)
        .await?;
    let admin: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM crm_user_profiles WHERE id=$1 AND workspace_id=$2 \
         AND role='admin' AND active)",
    )
    .bind(sender)
    .bind(workspace)
    .fetch_one(&mut **tx)
    .await?;
    Ok(admin)
}
