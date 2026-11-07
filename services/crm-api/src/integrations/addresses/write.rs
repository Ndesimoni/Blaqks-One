//! Versioned address changes. An address is never deleted or moved to another member:
//! it is either active or reserved, and only its own member can have it back (E3d).
use super::store::{self, AddressRow};
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'a, 'b> = &'a mut Transaction<'b, Postgres>;

pub struct Change<'a> {
    pub workspace: &'a str,
    pub id: Uuid,
    pub version: i64,
    pub name: &'a str,
    pub state: &'a str,
    pub actor: Uuid,
}

/// `None` when the version no longer matches.
pub async fn apply(tx: Tx<'_, '_>, change: &Change<'_>) -> ApiResult<Option<AddressRow>> {
    let done = sqlx::query(
        "UPDATE integrations.crm_sendgrid_addresses
         SET display_name=$4,state=$5,version=version+1,updated_by=$6,updated_at=now()
         WHERE workspace_id=$1 AND id=$2 AND version=$3",
    )
    .bind(change.workspace)
    .bind(change.id)
    .bind(change.version)
    .bind(change.name)
    .bind(change.state)
    .bind(change.actor)
    .execute(&mut **tx)
    .await
    .map_err(store::write_error)?;
    if done.rows_affected() == 0 {
        return Ok(None);
    }
    store::by_id(tx, change.workspace, change.id).await
}

/// Members who leave or lose the email grant keep their addresses reserved, so mail to
/// them goes to Unassigned and no new hire receives it. Called from `departure`.
pub async fn reserve_members(
    tx: Tx<'_, '_>,
    workspace: &str,
    members: &[Uuid],
    actor: Uuid,
) -> ApiResult<()> {
    sqlx::query(
        "UPDATE integrations.crm_sendgrid_addresses
         SET state='reserved',version=version+1,updated_by=$3,updated_at=now()
         WHERE workspace_id=$1 AND member_id=ANY($2) AND state='active'",
    )
    .bind(workspace)
    .bind(members)
    .bind(actor)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
