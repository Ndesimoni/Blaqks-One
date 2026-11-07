//! Finance on departure (finance-design §5.1, §5.4, §13 M-F3): a staff member who stops
//! being active or loses the finance module releases the deals they hold — earned or not
//! — to the Admin queue, and their pending hand-overs are cancelled. Commission lines
//! stay attributed to them; losing teamView releases nothing. The agreements recording
//! those hand-overs are withdrawn in the same transaction (agreements design §14).
use crate::{agreements::handover, auth::permissions::Permissions, error::ApiResult};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// The `crm_assignments` reason when deals must be released, if any.
pub fn releases(
    active_before: bool,
    active_after: bool,
    before: &Permissions,
    after: &Permissions,
) -> Option<&'static str> {
    if active_before && !active_after {
        return Some("departure");
    }
    (before.finance && !after.finance).then_some("access_removed")
}

fn event_reason(reason: &str) -> &'static str {
    match reason {
        "departure" => "The holder left the team.",
        _ => "The holder no longer has finance access.",
    }
}

/// Call inside the member update or archive transaction, after its locks. Each released
/// deal steps its version once, with assignment history, an `assigned` finance event and
/// an `assigned` activity entry (actor = the acting Admin or Super Admin).
pub async fn release(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    member: Uuid,
    actor: Uuid,
    reason: &'static str,
) -> ApiResult<u64> {
    let (released, withdrawn): (i64, Vec<Uuid>) = sqlx::query_as(
        "WITH released AS (UPDATE crm_deals SET assignee_id=NULL,version=version+1, \
         updated_at=now() WHERE workspace_id=$1 AND assignee_id=$2 RETURNING id), \
         history AS (INSERT INTO crm_assignments \
         (id,workspace_id,record_id,collection,from_id,to_id,actor_id,reason) \
         SELECT gen_random_uuid(),$1,id,'Deals',$2,NULL,$3,$4 FROM released), \
         events AS (INSERT INTO crm_finance_events \
         (id,workspace_id,entity,entity_id,action,actor_id,changes,reason,created_at) \
         SELECT gen_random_uuid(),$1,'deal',id,'assigned',$3, \
         jsonb_build_object('assignee',jsonb_build_array($2::text,NULL)),$5,clock_timestamp() \
         FROM released), \
         activity AS (INSERT INTO crm_activity \
         (id,actor_id,workspace_id,action,collection,record_id) \
         SELECT gen_random_uuid(),$3,$1,'assigned','Deals',id FROM released), \
         cancelled AS (UPDATE crm_deal_handovers SET status='cancelled',decided_by=$3, \
         decided_at=now() WHERE workspace_id=$1 \
         AND status IN ('pending','awaiting_approval') \
         AND (from_id=$2 OR to_id=$2) RETURNING agreement_id) \
         SELECT (SELECT count(*) FROM released), \
         ARRAY(SELECT agreement_id FROM cancelled WHERE agreement_id IS NOT NULL)",
    )
    .bind(workspace)
    .bind(member)
    .bind(actor)
    .bind(reason)
    .bind(event_reason(reason))
    .fetch_one(&mut **tx)
    .await?;
    handover::withdraw_all(tx, &withdrawn, actor).await?;
    Ok(released as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deals_are_released_on_departure_or_losing_the_module_only() {
        let full = Permissions::full();
        let without = Permissions {
            finance: false,
            ..Permissions::full()
        };
        assert_eq!(releases(true, false, &full, &full), Some("departure"));
        assert_eq!(
            releases(true, true, &full, &without),
            Some("access_removed")
        );
        assert_eq!(releases(true, true, &without, &full), None);
        assert_eq!(releases(true, true, &full, &full), None);
        assert_eq!(releases(false, false, &without, &without), None);
        assert_eq!(event_reason("departure"), "The holder left the team.");
    }
}
