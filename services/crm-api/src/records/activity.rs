//! Reads of `crm_activity`, the owner side of the activity feed
//! (docs/team-activity-design.md). Rows are limited to the collections the live caller
//! is granted now; assigned-only staff read only their own actions. A row names its
//! record only while that record exists and is visible to the caller now.
use super::visibility::{predicate, RecordScope};
use crate::{
    activity::window::{Item, Person, RecordRef, Window},
    auth::{finance_access::FinanceScope, profile::UserRow},
    error::ApiResult,
    finance::visibility::activity_legacy_id,
    performance::visibility::activity_target,
};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

const RECORDS: [&str; 8] = [
    "Clients",
    "Contacts",
    "Properties",
    "Follow-ups",
    "Viewings",
    "Shortlist",
    "Interaction log",
    "Client care",
];
pub const FINANCE: [&str; 3] = ["Deals", "Payments", "Expenses"];

/// Collections whose activity `user` may read: record collections by module grant,
/// finance by the finance module (team-scope staff also need `teamView`), and Targets
/// by the reports module. Unknown names are never granted.
pub fn feed_collections(user: &UserRow) -> Vec<&'static str> {
    let finance = match user.finance_access().scope {
        FinanceScope::Team => true,
        FinanceScope::Own => !user.has_team_scope(),
        FinanceScope::None => false,
    };
    let mut granted: Vec<&'static str> = RECORDS
        .into_iter()
        .filter(|name| user.can_collection(name))
        .collect();
    if finance {
        granted.extend(FINANCE);
    }
    if user.effective_permissions().reports {
        granted.push("Targets");
    }
    granted
}

#[derive(FromRow)]
struct Row {
    id: Uuid,
    action: String,
    collection: String,
    actor_id: Uuid,
    actor_name: String,
    sample: bool,
    micros: i64,
    at: String,
    record_id: Uuid,
    record_legacy: Option<String>,
    finance_legacy: Option<String>,
    target_id: Option<Uuid>,
}

/// One page of record activity, newest first, at most `window.fetch` rows.
pub async fn page(
    transaction: &mut Transaction<'_, Postgres>,
    window: &Window,
    collections: &[&str],
    user: &UserRow,
) -> ApiResult<Vec<Item>> {
    let scope = RecordScope::of(user);
    let finance_caller = match user.finance_access().scope {
        FinanceScope::Team => None,
        _ => Some(user.id),
    };
    let own_only = (!scope.is_team()).then_some(user.id);
    let sql = format!(
        "SELECT a.id,a.action,a.collection,a.actor_id,actor.name AS actor_name,\
         a.source='sample' AS sample,{stamps},a.record_id,r.legacy_id AS record_legacy,\
         {finance} AS finance_legacy,{target} AS target_id \
         FROM crm_activity a JOIN crm_all_user_profiles actor ON actor.id=a.actor_id \
         LEFT JOIN crm_records r ON r.id=a.record_id AND r.workspace_id=$1 \
         AND r.collection=a.collection AND {visible} \
         WHERE {window} AND a.collection=ANY($8) AND ($12::uuid IS NULL OR a.actor_id=$12) \
         ORDER BY a.created_at DESC,a.id DESC LIMIT $7",
        stamps = Window::stamps("a"),
        finance = activity_legacy_id("a", "$1", "$10"),
        target = activity_target("a", "$1", "$11", user),
        visible = predicate("r", "$1", "$9"),
        window = Window::clause("a"),
    );
    let rows = window
        .bind(sqlx::query_as::<_, Row>(&sql))
        .bind(collections)
        .bind(scope.caller())
        .bind(finance_caller)
        .bind(user.id)
        .bind(own_only)
        .fetch_all(&mut **transaction)
        .await?;
    Ok(rows.into_iter().map(item).collect())
}

fn item(row: Row) -> Item {
    let record = if FINANCE.contains(&row.collection.as_str()) {
        row.finance_legacy.map(Some)
    } else if row.collection == "Targets" {
        row.target_id.map(|_| None)
    } else {
        row.record_legacy.map(Some)
    }
    .map(|legacy_id| RecordRef {
        id: row.record_id,
        legacy_id,
    });
    Item {
        id: row.id,
        at: row.at,
        kind: "record",
        action: row.action,
        collection: Some(row.collection),
        actor: Person {
            id: row.actor_id,
            name: row.actor_name,
        },
        record,
        member: None,
        sample: row.sample,
        micros: row.micros,
    }
}
