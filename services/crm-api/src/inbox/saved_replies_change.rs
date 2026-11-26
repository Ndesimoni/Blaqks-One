//! Editing and removing a saved reply (docs/saved-replies-drafts.md §3–§4): only the
//! owner's own, or the company's for the Admin, at the version the screen last saw.
use super::{item, member, saved, Row, COLUMNS};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    inbox::{
        access,
        saved_reply_input::{self, INVALID},
    },
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

const RELOAD: &str = "This saved reply changed. Reload and try again.";

/// The reply the member may change, locked: their own, or the company's for the Admin.
async fn changeable(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    session: &Session,
    id: &str,
    expected: i32,
) -> ApiResult<(Uuid, Row)> {
    let id = access::id(id)?;
    let (me, admin) = member(tx, workspace, session).await?;
    // Anything the member may not change reads as missing, before the version (review M3).
    let row: Row = sqlx::query_as(&format!(
        "SELECT {COLUMNS} FROM inbox.crm_inbox_saved_replies WHERE id=$1 AND workspace_id=$2 \
         AND (owner_user_id=$3 OR (owner_user_id IS NULL AND $4)) FOR UPDATE"
    ))
    .bind(id)
    .bind(workspace)
    .bind(me)
    .bind(admin)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(ApiError::missing)?;
    if row.version != expected {
        return Err(ApiError::stale(RELOAD));
    }
    Ok((me, row))
}

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let (expected, text) = saved_reply_input::update(body)?;
    let mut tx = state.pool.begin().await?;
    let (me, current) = changeable(&mut tx, &workspace, &session, &id, expected).await?;
    let row: Row = saved(
        sqlx::query_as(&format!(
            "UPDATE inbox.crm_inbox_saved_replies SET title=$2,body=$3,version=version+1, \
               updated_by=$4,updated_at=now() WHERE id=$1 RETURNING {COLUMNS}"
        ))
        .bind(current.id)
        .bind(&text.title)
        .bind(&text.body)
        .bind(me)
        .fetch_one(&mut *tx)
        .await,
    )?;
    tx.commit().await?;
    Ok(Json(json!({"savedReply": item(&row)})))
}

pub async fn remove(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<StatusCode> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let expected = saved_reply_input::remove(body)?;
    let mut tx = state.pool.begin().await?;
    let (_, current) = changeable(&mut tx, &workspace, &session, &id, expected).await?;
    sqlx::query("DELETE FROM inbox.crm_inbox_saved_replies WHERE id=$1")
        .bind(current.id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}
