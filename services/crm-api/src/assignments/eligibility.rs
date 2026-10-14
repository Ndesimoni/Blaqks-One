use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
    records::{
        history::{self, Change},
        mutation::{Entry, ENTRY_COLUMNS},
        target::Target,
        visibility::{predicate, RecordScope},
    },
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

const INELIGIBLE: &str = "Choose an active team member with access to this record type.";

/// An approved teammate: an active member of `workspace` whose owner is active and who
/// holds the collection's grant. `FOR SHARE` on the user row serialises the check with
/// a concurrent suspension or archive of that member (M3).
pub async fn eligible(
    tx: &mut Tx<'_>,
    workspace: &str,
    collection: &str,
    candidate: Uuid,
) -> ApiResult<()> {
    sqlx::query("SELECT 1 FROM crm_users WHERE id=$1 FOR SHARE")
        .bind(candidate)
        .fetch_optional(&mut **tx)
        .await?;
    let member = sqlx::query_as::<_, UserRow>(
        "SELECT * FROM crm_user_profiles WHERE id=$1 AND workspace_id=$2 AND active \
         AND owner_active",
    )
    .bind(candidate)
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?;
    match member {
        Some(member) if member.can_collection(collection) => Ok(()),
        _ => Err(ApiError::invalid(INELIGIBLE)),
    }
}

/// Step 7: team scope, or the current holder. A Follow-up's holder is its direct
/// assignee, or the holder of its client when it has none.
pub fn ensure_holder(scope: RecordScope, collection: &str, target: &Target) -> ApiResult<()> {
    let holds = match scope {
        RecordScope::Team => true,
        RecordScope::Assigned(caller) => {
            target.assignee_id == Some(caller)
                || (collection == "Follow-ups"
                    && target.assignee_id.is_none()
                    && target.holds_client)
        }
    };
    if !holds {
        return Err(ApiError::denied(
            "Only the current assignee, the Admin or a full-team member can reassign this record.",
        ));
    }
    Ok(())
}

/// Writes one assignment change (version step, history, optional note, activity).
pub async fn apply(tx: &mut Tx<'_>, change: &Change<'_>, note: Option<&str>) -> ApiResult<()> {
    let assignment = history::reassign(tx, change, true).await?;
    if let Some(note) = note {
        sqlx::query(
            "INSERT INTO crm_assignment_notes (assignment_id,record_id,note) VALUES ($1,$2,$3)",
        )
        .bind(assignment)
        .bind(change.record)
        .bind(note)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

/// The record as the caller now sees it, or `None` when it is no longer visible.
pub async fn visible_entry(
    tx: &mut Tx<'_>,
    workspace: &str,
    id: Uuid,
    scope: RecordScope,
) -> ApiResult<Option<Entry>> {
    let sql = format!(
        "SELECT {} FROM crm_records r WHERE r.id=$3 AND r.workspace_id=$1 AND {}",
        ENTRY_COLUMNS
            .split(',')
            .map(|column| format!("r.{column}"))
            .collect::<Vec<_>>()
            .join(","),
        predicate("r", "$1", "$2")
    );
    Ok(sqlx::query_as::<_, Entry>(&sql)
        .bind(workspace)
        .bind(scope.caller())
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?)
}
