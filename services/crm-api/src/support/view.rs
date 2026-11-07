//! Reading help requests: the member's own list, the Blaqks One side's queue and counts, and
//! a thread. People's names come from the published identity view.
use crate::{
    error::{ApiError, ApiResult},
    workspaces::platform,
};
use serde_json::{json, Value};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'a> = Transaction<'a, Postgres>;

const AT: &str = "'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'";

#[derive(FromRow)]
pub(super) struct Row {
    pub id: Uuid,
    pub workspace_id: String,
    pub requester_id: Uuid,
    requester_name: Option<String>,
    requester_role: Option<String>,
    category: String,
    subject: String,
    pub state: String,
    assignee_id: Option<Uuid>,
    assignee_name: Option<String>,
    created_at: String,
    updated_at: String,
    unread: bool,
    pub version: i64,
}

fn select(filter: &str) -> String {
    format!(
        "SELECT r.id,r.workspace_id,r.requester_id,p.name AS requester_name, \
         p.role AS requester_role,r.category,r.subject,r.state,r.assignee_id, \
         a.name AS assignee_name, \
         to_char(r.created_at AT TIME ZONE 'UTC',{AT}) AS created_at, \
         to_char(r.updated_at AT TIME ZONE 'UTC',{AT}) AS updated_at, \
         EXISTS (SELECT 1 FROM support.crm_support_messages m WHERE m.request_id=r.id \
           AND m.side='platform' AND m.created_at > r.requester_read_at) AS unread, r.version \
         FROM support.crm_support_requests r \
         LEFT JOIN crm_all_user_profiles p ON p.id=r.requester_id \
         LEFT JOIN crm_all_user_profiles a ON a.id=r.assignee_id WHERE {filter} \
         ORDER BY r.updated_at DESC, r.id LIMIT 200"
    )
}

impl Row {
    pub(super) fn assignee(&self) -> Option<Uuid> {
        self.assignee_id
    }
}

pub(super) fn shape(row: &Row, company: Option<&String>) -> Value {
    json!({
        "id": row.id, "category": row.category, "subject": row.subject, "state": row.state,
        "company": {"id": row.workspace_id, "name": company},
        "requesterName": row.requester_name,
        "requesterRole": match row.requester_role.as_deref() { Some("admin") => "Admin", _ => "Staff" },
        "assigneeId": row.assignee_id, "assigneeName": row.assignee_name,
        "createdAt": row.created_at, "updatedAt": row.updated_at,
        "unread": row.unread, "version": row.version,
    })
}

/// A member's own requests in their company, newest first.
pub(super) async fn mine(tx: &mut Tx<'_>, workspace: &str, me: Uuid) -> ApiResult<Vec<Row>> {
    Ok(
        sqlx::query_as::<_, Row>(&select("r.workspace_id=$1 AND r.requester_id=$2"))
            .bind(workspace)
            .bind(me)
            .fetch_all(&mut **tx)
            .await?,
    )
}

/// The Blaqks One queue: by state (`all` for every state) and, with `assignee`, theirs.
pub(super) async fn queue(
    tx: &mut Tx<'_>,
    state: &str,
    assignee: Option<Uuid>,
) -> ApiResult<Vec<Row>> {
    Ok(sqlx::query_as::<_, Row>(&select(
        "($1='all' OR r.state=$1) AND ($2::uuid IS NULL OR r.assignee_id=$2)",
    ))
    .bind(state)
    .bind(assignee)
    .fetch_all(&mut **tx)
    .await?)
}

pub(super) async fn one(tx: &mut Tx<'_>, id: Uuid) -> ApiResult<Row> {
    sqlx::query_as::<_, Row>(&select("r.id=$1"))
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(ApiError::missing)
}

/// The rows with their companies' names.
pub(super) async fn shaped(tx: &mut Tx<'_>, rows: &[Row]) -> ApiResult<Vec<Value>> {
    let ids: Vec<String> = rows.iter().map(|row| row.workspace_id.clone()).collect();
    let names = platform::company_names(tx, &ids).await?;
    Ok(rows
        .iter()
        .map(|row| shape(row, names.get(&row.workspace_id)))
        .collect())
}

/// The thread, oldest first.
pub(super) async fn messages(tx: &mut Tx<'_>, id: Uuid) -> ApiResult<Vec<Value>> {
    let rows: Vec<(Uuid, String, Option<String>, String, String)> = sqlx::query_as(&format!(
        "SELECT m.id,m.side,u.name,m.body,to_char(m.created_at AT TIME ZONE 'UTC',{AT}) \
         FROM support.crm_support_messages m LEFT JOIN crm_all_user_profiles u \
         ON u.id=m.author_id WHERE m.request_id=$1 ORDER BY m.created_at,m.id"
    ))
    .bind(id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(id, side, name, body, at)| {
            json!({"id": id, "side": side, "authorName": name, "body": body, "at": at})
        })
        .collect())
}

/// Requests in each state, for the Blaqks One queue's filters.
pub(super) async fn counts(tx: &mut Tx<'_>) -> ApiResult<Value> {
    let rows: Vec<(String, i64)> =
        sqlx::query_as("SELECT state,count(*) FROM support.crm_support_requests GROUP BY state")
            .fetch_all(&mut **tx)
            .await?;
    let count = |state: &str| rows.iter().find(|(s, _)| s == state).map_or(0, |(_, n)| *n);
    Ok(json!({"open": count("open"), "waiting": count("waiting"), "solved": count("solved")}))
}
