//! `/inbox/saved-replies` (docs/saved-replies-drafts.md §3–§4): the company's saved
//! replies, kept by the Admin, and each member's own, which nobody else sees. Another
//! member's reply, another company's and a guessed ID all give the same not-found.
use super::{
    access,
    saved_reply_input::{self, Scope, Text, INVALID},
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

const FULL: &str = "This list is full. Remove a saved reply first.";
const TAKEN: &str = "This list already has a saved reply with that title.";
const COLUMNS: &str = "id,owner_user_id,title,body,version";

#[derive(FromRow)]
struct Row {
    id: Uuid,
    owner_user_id: Option<Uuid>,
    title: String,
    body: String,
    version: i32,
}

fn item(row: &Row) -> Value {
    json!({"id": row.id, "title": row.title, "body": row.body, "version": row.version})
}

/// A duplicate title in the same list is a conflict, not a server error.
fn saved(result: Result<Row, sqlx::Error>) -> ApiResult<Row> {
    result.map_err(|error| match &error {
        sqlx::Error::Database(db) if db.is_unique_violation() => ApiError::conflict(TAKEN),
        _ => error.into(),
    })
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    access::ensure_member(&state, &session, &workspace).await?;
    let rows: Vec<Row> = sqlx::query_as(&format!(
        "SELECT {COLUMNS} FROM inbox.crm_inbox_saved_replies WHERE workspace_id=$1 \
         AND (owner_user_id IS NULL OR owner_user_id=$2) ORDER BY lower(title),id"
    ))
    .bind(&workspace)
    .bind(session.user.id)
    .fetch_all(&state.pool)
    .await?;
    let (company, mine): (Vec<&Row>, Vec<&Row>) =
        rows.iter().partition(|row| row.owner_user_id.is_none());
    Ok(Json(json!({
        "company": company.into_iter().map(item).collect::<Vec<_>>(),
        "mine": mine.into_iter().map(item).collect::<Vec<_>>(),
        "canManageCompany": session.user.role == "admin",
    })))
}

/// Locks the company, re-reads the live member and returns `(member, is Admin)`.
async fn member(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    session: &Session,
) -> ApiResult<(Uuid, bool)> {
    workspaces::lock(tx, workspace).await?;
    let live = access::live(tx, workspace, session.user.id).await?;
    Ok((live.id, live.role == "admin"))
}

pub async fn create(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let (scope, Text { title, body }) = saved_reply_input::create(body)?;
    let mut tx = state.pool.begin().await?;
    let (me, admin) = member(&mut tx, &workspace, &session).await?;
    let (owner, limit) = match scope {
        Scope::Company if !admin => return Err(ApiError::forbidden()),
        Scope::Company => (None, 200),
        Scope::Mine => (Some(me), 100),
    };
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM inbox.crm_inbox_saved_replies \
         WHERE workspace_id=$1 AND owner_user_id IS NOT DISTINCT FROM $2",
    )
    .bind(&workspace)
    .bind(owner)
    .fetch_one(&mut *tx)
    .await?;
    if count >= limit {
        return Err(ApiError::conflict(FULL));
    }
    let row = saved(
        sqlx::query_as(&format!(
            "INSERT INTO inbox.crm_inbox_saved_replies \
               (id,workspace_id,owner_user_id,title,body,created_by,updated_by) \
             VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING {COLUMNS}"
        ))
        .bind(Uuid::new_v4())
        .bind(&workspace)
        .bind(owner)
        .bind(&title)
        .bind(&body)
        .bind(me)
        .fetch_one(&mut *tx)
        .await,
    )?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({"savedReply": item(&row)}))))
}

#[path = "saved_replies_change.rs"]
mod change;
pub use change::{remove, update};
