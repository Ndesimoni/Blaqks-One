//! Releases a member's records when they leave or lose a grant (contract §7, M3).
use crate::{auth::permissions::Permissions, error::ApiResult, records::visibility::ASSIGNABLE};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Assignable collections to release for a staff member whose effective permissions
/// change from `before` to `after`: all of them when the member stops being active,
/// otherwise each collection whose grant is removed. Returns `(collections, reason)`.
pub fn releases(
    active_before: bool,
    active_after: bool,
    before: &Permissions,
    after: &Permissions,
) -> (Vec<&'static str>, &'static str) {
    if active_before && !active_after {
        return (ASSIGNABLE.to_vec(), "departure");
    }
    let removed = ASSIGNABLE
        .into_iter()
        .filter(|name| before.collection(name) && !after.collection(name))
        .collect();
    (removed, "access_removed")
}

/// Call inside the caller's transaction, after its workspace and member locks. Clients,
/// Properties and Contacts go to the Admin queue; Follow-ups lose their direct assignee.
/// Each record's version steps once, with a history row and an `assigned` activity row
/// (actor = the acting Admin or Super Admin). Returns how many records were released.
pub async fn release(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    member: Uuid,
    collections: &[&str],
    actor: Uuid,
    reason: &'static str,
) -> ApiResult<u64> {
    if reason == "departure" {
        // A leaving member's read-only keeps end with them (agreements design §18).
        crate::records::keeps::forget(tx, workspace, member).await?;
    }
    if collections.is_empty() {
        return Ok(0);
    }
    let released: i64 = sqlx::query_scalar(
        "WITH released AS (UPDATE crm_records SET assignee_id=NULL,version=version+1,\
         updated_at=now() WHERE workspace_id=$1 AND assignee_id=$2 AND collection=ANY($3) \
         RETURNING id,collection), \
         history AS (INSERT INTO crm_assignments \
         (id,workspace_id,record_id,collection,from_id,to_id,actor_id,reason) \
         SELECT gen_random_uuid(),$1,id,collection,$2,NULL,$4,$5 FROM released), \
         activity AS (INSERT INTO crm_activity \
         (id,actor_id,workspace_id,action,collection,record_id) \
         SELECT gen_random_uuid(),$4,$1,'assigned',collection,id FROM released) \
         SELECT count(*) FROM released",
    )
    .bind(workspace)
    .bind(member)
    .bind(collections)
    .bind(actor)
    .bind(reason)
    .fetch_one(&mut **tx)
    .await?;
    Ok(released as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn releases_follow_the_effective_permission_comparison() {
        let full = Permissions::full();
        assert_eq!(
            releases(true, false, &full, &full),
            (ASSIGNABLE.to_vec(), "departure")
        );
        let schedule = Permissions {
            schedule: true,
            properties: true,
            ..Default::default()
        };
        let (removed, reason) = releases(true, true, &full, &schedule);
        assert_eq!(
            (removed, reason),
            (vec!["Clients", "Contacts"], "access_removed")
        );
        assert!(releases(true, true, &schedule, &full).0.is_empty());
        assert!(releases(false, false, &full, &full).0.is_empty());
    }
}
