use super::requests;
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    records::{
        validation::collection_key,
        visibility::{predicate, RecordScope},
    },
    state::AppState,
    workspaces,
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow)]
struct Row {
    at: String,
    reason: String,
    from_id: Option<Uuid>,
    from_name: Option<String>,
    to_id: Option<Uuid>,
    to_name: Option<String>,
    actor_id: Option<Uuid>,
    actor_name: Option<String>,
    note: Option<String>,
}

fn person(id: Option<Uuid>, name: Option<String>) -> Value {
    id.map_or(Value::Null, |id| json!({"id": id, "name": name}))
}

/// `GET /workspaces/{ws}/records/{collection}/{id}/assignments` (M4). The record must be
/// visible; otherwise the response is the same 404 as an unknown ID. Assigned-only
/// callers see departures and permission releases as a generic Admin reassignment.
pub async fn history(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, collection, id)): Path<(String, String, String)>,
) -> ApiResult<Json<Value>> {
    workspaces::ensure_access(&state, &session, &workspace).await?;
    collection_key(&collection)?;
    if !session.user.can_collection(&collection) {
        return Err(ApiError::forbidden());
    }
    requests::ensure_assignable(&collection)?;
    let id = Uuid::parse_str(&id).map_err(|_| ApiError::invalid("Invalid server record ID."))?;
    let mut tx = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let user = workspaces::member(&mut tx, &workspace, session.user.id).await?;
    if !user.can_collection(&collection) {
        return Err(ApiError::forbidden());
    }
    let scope = RecordScope::of(&user);
    let sql = format!(
        "SELECT EXISTS(SELECT 1 FROM crm_records r WHERE r.id=$3 AND r.workspace_id=$1 \
         AND r.collection=$4 AND {})",
        predicate("r", "$1", "$2")
    );
    let visible: bool = sqlx::query_scalar(&sql)
        .bind(&workspace)
        .bind(scope.caller())
        .bind(id)
        .bind(&collection)
        .fetch_one(&mut *tx)
        .await?;
    if !visible {
        return Err(ApiError::missing());
    }
    let rows = sqlx::query_as::<_, Row>(
        "SELECT to_char(h.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS at,\
         h.reason,h.from_id,f.name AS from_name,h.to_id,t.name AS to_name,h.actor_id,\
         a.name AS actor_name,n.note FROM crm_assignments h \
         LEFT JOIN crm_users f ON f.id=h.from_id LEFT JOIN crm_users t ON t.id=h.to_id \
         LEFT JOIN crm_users a ON a.id=h.actor_id \
         LEFT JOIN crm_assignment_notes n ON n.assignment_id=h.id \
         WHERE h.record_id=$1 AND h.workspace_id=$2 ORDER BY h.created_at,h.id",
    )
    .bind(id)
    .bind(&workspace)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let generic = !scope.is_team();
    let history: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            let released = matches!(row.reason.as_str(), "departure" | "access_removed");
            let (reason, actor) = if generic && released {
                ("admin_reassigned".to_owned(), Value::Null)
            } else {
                (row.reason, person(row.actor_id, row.actor_name))
            };
            json!({"at": row.at, "reason": reason, "from": person(row.from_id, row.from_name),
                "to": person(row.to_id, row.to_name), "actor": actor, "note": row.note})
        })
        .collect();
    Ok(Json(json!({ "history": history })))
}
