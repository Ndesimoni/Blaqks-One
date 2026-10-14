//! Read-only projections beside the visible records (contract §3). Each one returns
//! only the fields listed there and nothing in it is pickable.
use super::list::{row_ids, visible_ids, Row};
use crate::{auth::profile::UserRow, error::ApiResult};
use serde_json::{json, Map, Value};
use sqlx::{Postgres, Transaction};
use std::collections::BTreeSet;

type Tx<'c> = Transaction<'c, Postgres>;

/// `(collection, id key, name key)` of the M1 references.
const REFERENCES: [(&str, &str, &str); 3] = [
    ("Clients", "client_id", "full_name"),
    ("Properties", "property_id", "listing_title"),
    ("Contacts", "contact_id", "full_name"),
];

/// A payload field as a string, or NULL for anything else.
fn text(field: &str) -> String {
    format!("CASE WHEN jsonb_typeof(payload->'{field}')='string' THEN payload->>'{field}' END")
}

pub async fn build(
    tx: &mut Tx<'_>,
    workspace: &str,
    user: &UserRow,
    rows: &[Row],
) -> ApiResult<Value> {
    let (task_ids, task_clients) = task_clients(tx, workspace, user, rows).await?;
    let mut references = Map::new();
    for (collection, id_key, name_key) in REFERENCES {
        let mut wanted: BTreeSet<&str> = rows
            .iter()
            .flat_map(|row| match collection {
                "Contacts" => vec![&row.contact_id],
                "Properties" => vec![&row.property_ref],
                _ => vec![&row.client_ref, &row.referral_ref],
            })
            .filter_map(|link| link.as_deref())
            .collect();
        for id in visible_ids(rows, collection)
            .into_iter()
            .chain(task_ids.iter().map(String::as_str))
        {
            wanted.remove(id);
        }
        let found: Vec<(String, Option<String>)> =
            if user.can_collection(collection) && !wanted.is_empty() {
                let sql = format!(
                    "SELECT legacy_id,{} FROM crm_records WHERE workspace_id=$1 AND collection=$2 \
                 AND legacy_id=ANY($3) ORDER BY legacy_id",
                    text(name_key)
                );
                sqlx::query_as(&sql)
                    .bind(workspace)
                    .bind(collection)
                    .bind(wanted.into_iter().collect::<Vec<_>>())
                    .fetch_all(&mut **tx)
                    .await?
            } else {
                vec![]
            };
        let found = found
            .into_iter()
            .map(|(id, name)| json!({id_key: id, name_key: name}));
        references.insert(collection.into(), Value::Array(found.collect()));
    }
    let viewings = listing_viewings(tx, workspace, user, rows).await?;
    Ok(json!({"references": references, "taskClients": task_clients, "listingViewings": viewings}))
}

/// Decision 2: clients of visible Follow-ups directly assigned to the caller that the
/// caller cannot otherwise see; name, phone and email only, even without the grant.
async fn task_clients(
    tx: &mut Tx<'_>,
    workspace: &str,
    user: &UserRow,
    rows: &[Row],
) -> ApiResult<(Vec<String>, Value)> {
    let visible = visible_ids(rows, "Clients");
    let wanted: BTreeSet<&str> = rows
        .iter()
        .filter(|row| row.collection == "Follow-ups" && row.entry.assignee == Some(user.id))
        .filter_map(|row| row.client_ref.as_deref())
        .filter(|id| !visible.contains(id))
        .collect();
    if wanted.is_empty() {
        return Ok((vec![], json!([])));
    }
    let sql = format!(
        "SELECT legacy_id,{},{},{} FROM crm_records WHERE workspace_id=$1 \
         AND collection='Clients' AND legacy_id=ANY($2) ORDER BY legacy_id",
        text("full_name"),
        text("phone"),
        text("email")
    );
    type Contact = (String, Option<String>, Option<String>, Option<String>);
    let found: Vec<Contact> = sqlx::query_as(&sql)
        .bind(workspace)
        .bind(wanted.into_iter().collect::<Vec<_>>())
        .fetch_all(&mut **tx)
        .await?;
    let ids = found.iter().map(|row| row.0.clone()).collect();
    let rows = found.into_iter().map(|(id, name, phone, email)| {
        json!({"client_id": id, "full_name": name, "phone": phone, "email": email})
    });
    Ok((ids, Value::Array(rows.collect())))
}

/// Decision 6: other agents' Viewings on Properties the caller holds, as timing and the
/// responsible agent only. Never a viewing identifier, client or outcome.
async fn listing_viewings(
    tx: &mut Tx<'_>,
    workspace: &str,
    user: &UserRow,
    rows: &[Row],
) -> ApiResult<Value> {
    if !user.can_collection("Properties") {
        return Ok(json!([]));
    }
    type Viewing = (String, Option<String>, Option<uuid::Uuid>, Option<String>);
    let found: Vec<Viewing> = sqlx::query_as(
        "SELECT v.property_ref, CASE WHEN jsonb_typeof(v.payload->'appointment_date_time')='string' \
         AND char_length(v.payload->>'appointment_date_time')<=64 \
         THEN v.payload->>'appointment_date_time' END AS at, u.id, u.name \
         FROM crm_records v JOIN crm_records p ON p.workspace_id=v.workspace_id \
         AND p.collection='Properties' AND p.legacy_id=v.property_ref AND p.assignee_id=$2 \
         LEFT JOIN crm_records c ON c.workspace_id=v.workspace_id AND c.collection='Clients' \
         AND c.legacy_id=v.client_ref LEFT JOIN crm_users u ON u.id=c.assignee_id \
         WHERE v.workspace_id=$1 AND v.collection='Viewings' AND NOT (v.id=ANY($3)) \
         ORDER BY at NULLS LAST, u.name NULLS LAST, v.created_at, v.id",
    )
    .bind(workspace)
    .bind(user.id)
    .bind(row_ids(rows))
    .fetch_all(&mut **tx)
    .await?;
    let found = found.into_iter().map(|(property, at, agent, name)| {
        let agent = agent.map(|id| json!({"id": id, "name": name}));
        json!({"property_id": property, "appointment_date_time": at, "agent": agent})
    });
    Ok(Value::Array(found.collect()))
}
