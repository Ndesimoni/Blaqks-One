//! Assignment history (`crm_assignments`) and default holders (contract §5).
use super::{audit, collections::Links, visibility::PARENTS};
use crate::{auth::profile::UserRow, error::ApiResult};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// One assignment change. `reason` must be one of the migration's reasons.
pub struct Change<'a> {
    pub workspace: &'a str,
    pub record: Uuid,
    pub collection: &'a str,
    pub from: Option<Uuid>,
    pub to: Option<Uuid>,
    pub actor: Uuid,
    pub reason: &'static str,
}

/// Appends a history row and returns its ID (the key for an optional hand-off note).
pub async fn append(
    transaction: &mut Transaction<'_, Postgres>,
    change: &Change<'_>,
) -> ApiResult<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO crm_assignments \
         (id,workspace_id,record_id,collection,from_id,to_id,actor_id,reason) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    )
    .bind(id)
    .bind(change.workspace)
    .bind(change.record)
    .bind(change.collection)
    .bind(change.from)
    .bind(change.to)
    .bind(change.actor)
    .bind(change.reason)
    .execute(&mut **transaction)
    .await?;
    Ok(id)
}

/// Sets the assignee of a row the caller has locked and records history plus an
/// `assigned` activity entry. `bump` adds the version step and timestamp; pass false
/// when the same request already bumped them. Returns the history ID.
pub async fn reassign(
    transaction: &mut Transaction<'_, Postgres>,
    change: &Change<'_>,
    bump: bool,
) -> ApiResult<Uuid> {
    sqlx::query(
        "UPDATE crm_records SET assignee_id=$1, \
         version=version+CASE WHEN $4 THEN 1 ELSE 0 END, \
         updated_at=CASE WHEN $4 THEN now() ELSE updated_at END \
         WHERE id=$2 AND workspace_id=$3",
    )
    .bind(change.to)
    .bind(change.record)
    .bind(change.workspace)
    .bind(bump)
    .execute(&mut **transaction)
    .await?;
    let id = append(transaction, change).await?;
    let (workspace, collection, record) = (change.workspace, change.collection, change.record);
    audit::append(
        transaction,
        change.actor,
        workspace,
        "assigned",
        collection,
        record,
    )
    .await?;
    Ok(id)
}

/// The workspace owner when still an active member; otherwise `None` (the queue), since
/// the eligibility trigger refuses inactive assignees.
pub async fn active_owner(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
) -> ApiResult<Option<Uuid>> {
    Ok(sqlx::query_scalar(
        "SELECT p.id FROM crm_workspaces w JOIN crm_user_profiles p ON p.id=w.owner_id \
         WHERE w.id=$1 AND p.workspace_id=w.id AND p.active AND p.owner_active",
    )
    .bind(workspace)
    .fetch_optional(&mut **transaction)
    .await?)
}

/// Staff creators hold what they create; Admins and the Super Admin create for the
/// workspace owner (the Admin, or the Super Admin in the organisation workspace).
pub async fn default_holder(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    creator: &UserRow,
) -> ApiResult<Option<Uuid>> {
    if creator.role == "staff" {
        return Ok(Some(creator.id));
    }
    active_owner(transaction, workspace).await
}

/// Assignee for a new record: parents get the holder; a Follow-up gets it only when it
/// has no client; other collections inherit visibility and are never assigned.
pub fn initial(collection: &str, holder: Option<Uuid>, links: &Links) -> Option<Uuid> {
    if PARENTS.contains(&collection) || (collection == "Follow-ups" && links.client.is_none()) {
        holder
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_parents_and_clientless_follow_ups_start_assigned() {
        let holder = Some(Uuid::new_v4());
        let none = Links::default();
        let linked = Links {
            client: Some("CL-001".into()),
            ..Links::default()
        };
        for collection in PARENTS {
            assert_eq!(initial(collection, holder, &linked), holder);
        }
        assert_eq!(initial("Follow-ups", holder, &none), holder);
        assert_eq!(initial("Follow-ups", holder, &linked), None);
        assert_eq!(initial("Viewings", holder, &none), None);
        assert_eq!(initial("Client care", holder, &linked), None);
    }
}
