//! Share inbox, detail, waiting counts and eligible colleague choices.
use super::{access, store, view::Caller};
use crate::{
    auth::session::Session, error::ApiError, error::ApiResult, state::AppState, workspaces,
};
use axum::extract::{rejection::QueryRejection, Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

pub const QUERY: &str = "Provide a record ID or nothing.";

#[derive(Default, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct ListQuery {
    record_id: Option<String>,
}

async fn live(
    state: &AppState,
    session: &Session,
    workspace: &str,
) -> ApiResult<crate::auth::profile::UserRow> {
    access::reader(state, session, workspace).await?;
    let mut tx = state.pool.begin().await?;
    let user = workspaces::member(&mut tx, workspace, session.user.id).await?;
    tx.commit().await?;
    Ok(user)
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    query: Result<Query<ListQuery>, QueryRejection>,
) -> ApiResult<Json<Value>> {
    let user = live(&state, &session, &workspace).await?;
    // Outsiders get the not-found before any query error (review L2).
    let Query(query) = query.map_err(|_| ApiError::invalid(QUERY))?;
    let record = query.record_id.as_deref().map(access::id).transpose()?;
    let mut tx = state.pool.begin().await?;
    if let Some(id) = record {
        let found: Option<(String, Option<Uuid>)> = sqlx::query_as(
            "SELECT collection,assignee_id FROM crm_records WHERE workspace_id=$1 AND id=$2",
        )
        .bind(&workspace)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?;
        let allowed = found.is_some_and(|(collection, holder)| {
            user.can_collection(&collection) && (user.role == "admin" || holder == Some(user.id))
        });
        if !allowed {
            return Err(ApiError::missing());
        }
    }
    let tail = "AND ($3::uuid IS NULL OR s.record_id=$3) \
        AND ($3::uuid IS NOT NULL OR $5 OR s.from_id=$4 OR s.to_id=$4) \
        ORDER BY s.created_at DESC,s.id LIMIT 200";
    let scope = (!user.has_team_scope()).then_some(user.id);
    let rows = sqlx::query_as::<_, store::ShareRow>(&store::select(tail))
        .bind(&workspace)
        .bind(scope)
        .bind(record)
        .bind(user.id)
        .bind(user.role == "admin")
        .fetch_all(&mut *tx)
        .await?;
    let caller = Caller::of(&user, &workspace);
    let mut incoming = Vec::new();
    let mut outgoing = Vec::new();
    for row in rows {
        let is_incoming = row.to_id == user.id && !caller.admin;
        (if is_incoming {
            &mut incoming
        } else {
            &mut outgoing
        })
        .push(row.view(caller));
    }
    tx.commit().await?;
    Ok(Json(json!({"incoming": incoming, "outgoing": outgoing})))
}

pub async fn one(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    let user = live(&state, &session, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let scope = (!user.has_team_scope()).then_some(user.id);
    let row = store::find(&mut tx, &workspace, scope, access::id(&id)?, false)
        .await?
        .filter(|row| row.party(Caller::of(&user, &workspace)))
        .ok_or_else(ApiError::missing)?;
    let share = row.view(Caller::of(&user, &workspace));
    tx.commit().await?;
    Ok(Json(json!({"share": share})))
}

pub async fn waiting(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    let user = live(&state, &session, &workspace).await?;
    let rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT collection,count(*) FROM crm_record_shares WHERE workspace_id=$1 AND to_id=$2 \
         AND status='pending' AND expires_at>clock_timestamp() GROUP BY collection",
    )
    .bind(&workspace)
    .bind(user.id)
    .fetch_all(&state.pool)
    .await?;
    let mut counts = json!({"Clients":0,"Properties":0,"Contacts":0});
    for (collection, count) in rows {
        if user.can_collection(&collection) {
            counts[collection] = json!(count);
        }
    }
    Ok(Json(counts))
}
