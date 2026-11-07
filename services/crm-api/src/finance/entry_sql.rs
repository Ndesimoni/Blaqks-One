//! The one finance-predicate query behind every payment and expense read (finance-design
//! §5.2): hidden, unknown and other-workspace rows all give the same 404.
use super::{
    deals::gate,
    entry::{EntryState, Kind},
};
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use sqlx::{postgres::PgRow, FromRow, Postgres, Transaction};
use uuid::Uuid;

/// `$1` workspace, `$2` the acting user, `$3` the predicate caller (NULL = team view),
/// `$4` an optional agent filter, `$5` an optional row ID. `extra` adds kind columns.
pub fn select(kind: Kind, extra: &str, tail: &str) -> String {
    let entity = kind.entity().as_str();
    format!(
        "SELECT x.id,x.version,x.legacy_id,x.status,x.amount_fils,x.notes,x.submitted_by, \
         sb.name AS submitted_name,x.decided_by,db.name AS decided_name, \
         to_char(x.decided_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS decided_at, \
         x.decision_reason,({}) AS actor_party,EXISTS(SELECT 1 FROM crm_finance_events e \
         WHERE e.workspace_id=x.workspace_id AND e.entity='{entity}' AND e.entity_id=x.id \
         AND e.actor_id=$2 AND e.action IN ('updated','resubmitted') AND e.created_at >= \
         (SELECT max(m.created_at) FROM crm_finance_events m WHERE m.workspace_id=x.workspace_id \
         AND m.entity='{entity}' AND m.entity_id=x.id AND m.action IN ('submitted','resubmitted'))) \
         AS actor_edited{extra} FROM {} x JOIN crm_users sb ON sb.id=x.submitted_by \
         LEFT JOIN crm_users db ON db.id=x.decided_by WHERE x.workspace_id=$1 AND {} \
         AND ($4::uuid IS NULL OR {}) AND ($5::uuid IS NULL OR x.id=$5) {tail}",
        kind.party(),
        kind.table(),
        kind.predicate(),
        kind.agent()
    )
}

/// Rows of `sql` (built by [`select`]) visible to `user`.
pub async fn fetch<T>(
    tx: &mut Transaction<'_, Postgres>,
    sql: &str,
    workspace: &str,
    user: &UserRow,
    agent: Option<Uuid>,
    only: Option<Uuid>,
) -> ApiResult<Vec<T>>
where
    T: for<'r> FromRow<'r, PgRow> + Send + Unpin,
{
    Ok(sqlx::query_as::<_, T>(sql)
        .bind(workspace)
        .bind(user.id)
        .bind(gate::caller(user))
        .bind(agent)
        .bind(only)
        .fetch_all(&mut **tx)
        .await?)
}

/// Step 5: the visible row's approval state, locked (`FOR UPDATE`), or the identical 404.
pub async fn locked(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    user: &UserRow,
    kind: Kind,
    id: Uuid,
) -> ApiResult<EntryState> {
    let sql = select(kind, "", "FOR UPDATE OF x");
    let rows = fetch::<EntryState>(tx, &sql, workspace, user, None, Some(id)).await?;
    rows.into_iter().next().ok_or_else(ApiError::missing)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_read_is_scoped_by_workspace_and_the_finance_predicate() {
        for (kind, table, own) in [
            (Kind::Payment, "FROM crm_payments x", "held.assignee_id=$3"),
            (Kind::Expense, "FROM crm_expenses x", "x.incurred_by=$3"),
        ] {
            let sql = select(kind, ",x.extra", "FOR UPDATE OF x");
            assert!(sql.contains(table) && sql.contains("WHERE x.workspace_id=$1"));
            assert!(
                sql.contains("($3::uuid IS NULL OR") && sql.contains(own),
                "{sql}"
            );
            assert!(
                sql.contains("AS actor_edited,x.extra FROM") && sql.ends_with("FOR UPDATE OF x")
            );
            assert!(sql.contains(&format!("e.entity='{}'", kind.entity().as_str())));
        }
    }
}
