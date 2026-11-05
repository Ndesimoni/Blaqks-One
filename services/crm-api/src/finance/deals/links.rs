//! Deal links and members (finance-design §5.4, §13 M-F1, L-F1). Hidden and unknown
//! clients and properties give the identical `link_missing`; finance members are
//! re-read with `FOR SHARE` so a concurrent suspension or archive is serialised.
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
    records::{
        collections::Slot,
        links::missing_message,
        visibility::{predicate, RecordScope},
    },
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

/// A changed client: staff must hold it (M-F1); Admins may use any workspace client. The
/// caller also needs the relationships grant.
pub async fn ensure_client(
    tx: &mut Tx<'_>,
    workspace: &str,
    user: &UserRow,
    client: &str,
    previous: Option<&str>,
) -> ApiResult<()> {
    if previous == Some(client) {
        return Ok(());
    }
    let holder = (user.role != "admin").then_some(user.id);
    let present: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM crm_records c WHERE c.workspace_id=$1 \
         AND c.collection='Clients' AND c.legacy_id=$2 AND ($3::uuid IS NULL OR c.assignee_id=$3))",
    )
    .bind(workspace)
    .bind(client)
    .bind(holder)
    .fetch_one(&mut **tx)
    .await?;
    if !(present && user.can_collection("Clients")) {
        return Err(ApiError::link_missing(missing_message(Slot::Client)));
    }
    Ok(())
}

/// A changed property must be visible under the records predicate and the caller needs
/// the properties grant.
pub async fn ensure_property(
    tx: &mut Tx<'_>,
    workspace: &str,
    user: &UserRow,
    property: Option<&str>,
    previous: Option<&str>,
) -> ApiResult<()> {
    let Some(property) = property.filter(|property| Some(*property) != previous) else {
        return Ok(());
    };
    let sql = format!(
        "SELECT EXISTS(SELECT 1 FROM crm_records r WHERE r.workspace_id=$1 \
         AND r.collection='Properties' AND r.legacy_id=$2 AND {})",
        predicate("r", "$1", "$3")
    );
    let present: bool = sqlx::query_scalar(&sql)
        .bind(workspace)
        .bind(property)
        .bind(RecordScope::of(user).caller())
        .fetch_one(&mut **tx)
        .await?;
    if !(present && user.can_collection("Properties")) {
        return Err(ApiError::link_missing(missing_message(Slot::Property)));
    }
    Ok(())
}

/// The active member `id` of the workspace when they hold the finance module; `staff`
/// limits it to staff (second agents, hand-over receivers, revised primary agents).
pub async fn finance_member(
    tx: &mut Tx<'_>,
    workspace: &str,
    id: Uuid,
    staff: bool,
) -> ApiResult<bool> {
    sqlx::query("SELECT 1 FROM crm_users WHERE id=$1 FOR SHARE")
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?;
    let member = sqlx::query_as::<_, UserRow>(
        "SELECT * FROM crm_user_profiles WHERE id=$1 AND workspace_id=$2 AND active \
         AND owner_active",
    )
    .bind(id)
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(member.is_some_and(|member| {
        member.effective_permissions().finance && (!staff || member.role == "staff")
    }))
}

/// Admin-created deals go to the client's holder when they can hold deals, else the
/// queue (§13 M-F1); staff hold what they create.
pub async fn initial_holder(
    tx: &mut Tx<'_>,
    workspace: &str,
    creator: &UserRow,
    client: &str,
) -> ApiResult<Option<Uuid>> {
    if creator.role == "staff" {
        return Ok(Some(creator.id));
    }
    let holder: Option<Uuid> = sqlx::query_scalar(
        "SELECT assignee_id FROM crm_records WHERE workspace_id=$1 AND collection='Clients' \
         AND legacy_id=$2",
    )
    .bind(workspace)
    .bind(client)
    .fetch_optional(&mut **tx)
    .await?
    .flatten();
    match holder {
        Some(id) if finance_member(tx, workspace, id, false).await? => Ok(Some(id)),
        _ => Ok(None),
    }
}
