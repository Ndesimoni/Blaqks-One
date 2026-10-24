//! `GET /agreements/listing-shares?side=incoming|sent` (the newest 200; an Admin reads the
//! company's), `?recordId=` (the shares of one listing the caller sent, or the Admin's
//! company sent) and `GET /agreements/listing-shares/{id}`, the link's target, where the
//! agent's first read is recorded once as `opened`, evidence of receipt.
use super::{
    access::{self, Caller, Viewer},
    co_broking_view, places,
    store::{self, ShareRow},
    view::{self, Companies},
};
use crate::{
    agreements::parties,
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use std::collections::HashMap;
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

/// The wire views of `rows` as `caller` reads them, with both company names.
pub async fn views(
    tx: &mut Tx<'_>,
    rows: &[ShareRow],
    caller: &Caller<'_>,
) -> ApiResult<Vec<Value>> {
    let mut names: HashMap<String, Option<String>> = HashMap::new();
    let mut out = Vec::with_capacity(rows.len());
    let held = places::held(tx, rows, caller).await?;
    for row in rows {
        let Some(place) = places::place(row, caller, &held) else {
            continue;
        };
        for workspace in [&row.workspace_id, &row.recipient_workspace_id] {
            if !names.contains_key(workspace) {
                let name = parties::company(tx, workspace).await?;
                names.insert(workspace.clone(), name);
            }
        }
        let companies = Companies {
            from: names[&row.workspace_id].clone(),
            to: names[&row.recipient_workspace_id].clone(),
        };
        out.push(view::view(row, place, &companies));
    }
    Ok(out)
}

/// One view with its co-broking, or the shared not-found.
pub async fn one_view(tx: &mut Tx<'_>, row: &ShareRow, caller: &Caller<'_>) -> ApiResult<Value> {
    let found = views(tx, std::slice::from_ref(row), caller).await?;
    let view = found.into_iter().next().ok_or_else(ApiError::missing)?;
    co_broking_view::attach(tx, row, caller, view).await
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    Query(query): Query<HashMap<String, String>>,
) -> ApiResult<Json<Value>> {
    access::reader(&state, &session, &workspace).await?;
    let caller = Caller::of(&session, &workspace);
    let record = query.get("recordId").map(|id| access::id(id)).transpose()?;
    let filter = match (query.get("side").map(String::as_str), record) {
        (Some("incoming"), None) => "s.recipient_workspace_id=$1 AND ($3 OR s.to_id=$2)",
        (Some("sent"), None) => "s.workspace_id=$1 AND ($3 OR s.from_id=$2)",
        (None, Some(_)) => "s.workspace_id=$1 AND ($3 OR s.from_id=$2)",
        _ => return Err(ApiError::invalid("Choose incoming or sent shares.")),
    };
    let sql = store::select(&format!(
        "{filter} AND ($4::uuid IS NULL OR s.source_record_id=$4) \
         ORDER BY s.created_at DESC LIMIT 200"
    ));
    let mut tx = state.pool.begin().await?;
    let rows: Vec<ShareRow> = sqlx::query_as(&sql)
        .bind(&workspace)
        .bind(caller.id)
        .bind(caller.admin)
        .bind(record)
        .fetch_all(&mut *tx)
        .await?;
    let shares = views(&mut tx, &rows, &caller).await?;
    tx.commit().await?;
    Ok(Json(json!({ "shares": shares })))
}

pub async fn one(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    access::reader(&state, &session, &workspace).await?;
    let id: Uuid = access::id(&id)?;
    let caller = Caller::of(&session, &workspace);
    let mut tx = state.pool.begin().await?;
    let row = store::find(&mut tx, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    let place = places::viewer(&row, &caller).ok_or_else(ApiError::missing)?;
    let first = row.opened_at.is_none() && row.open() && !row.paused();
    let row = match place == Viewer::Agent && first {
        true => opened(&mut tx, row, caller.id).await?,
        false => row,
    };
    let share = one_view(&mut tx, &row, &caller).await?;
    tx.commit().await?;
    Ok(Json(json!({ "share": share })))
}

/// Records the agent's first read of an open share, once.
async fn opened(tx: &mut Tx<'_>, row: ShareRow, agent: Uuid) -> ApiResult<ShareRow> {
    let marked: Option<Uuid> = sqlx::query_scalar(
        "UPDATE agreements.crm_listing_shares SET opened_at=now() WHERE id=$1 \
         AND opened_at IS NULL AND status IN ('pending','accepted') AND CASE WHEN \
         status='pending' THEN least(offer_ends_at,view_ends_at) ELSE view_ends_at END \
         > clock_timestamp() RETURNING id",
    )
    .bind(row.id)
    .fetch_optional(&mut **tx)
    .await?;
    if marked.is_none() {
        return Ok(row);
    }
    store::event(
        tx,
        row.id,
        "opened",
        Some((agent, "recipient")),
        (None, None),
    )
    .await?;
    Ok(store::find(tx, row.id).await?.unwrap_or(row))
}
