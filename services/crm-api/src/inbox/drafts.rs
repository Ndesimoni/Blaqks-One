//! `GET/PUT /inbox/conversations/{id}/draft` (docs/saved-replies-drafts.md §3): the
//! caller's own unsent reply on a conversation they can see now. Drafts skip the company
//! lock on purpose (security review M2): the live member and the conversation's visibility
//! are read in the write's own transaction and checked again on every read, so a draft
//! written during an archive or reassignment is never shown. A save names the revision it
//! builds on, so an autosave that arrives after the reply was sent is refused (H1).
use super::{
    access::{self, Viewer},
    draft_input::{input, DRAFT},
    read::load,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

const CHANGED: &str = "This draft changed in another window. Reload the conversation.";
const TOO_MANY: &str = "You have too many drafts. Send or clear some first.";
const MAX_DRAFTS: i64 = 300;

/// The live member, after checking they can see the conversation now.
async fn visible(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    session: &Session,
    id: Uuid,
) -> ApiResult<Uuid> {
    let viewer = Viewer::of(&access::live(tx, workspace, session.user.id).await?);
    load(tx, workspace, &viewer, id, false)
        .await?
        .ok_or_else(ApiError::missing)?;
    Ok(viewer.id)
}

pub async fn get(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    access::ensure_member(&state, &session, &workspace).await?;
    let id = access::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let me = visible(&mut tx, &workspace, &session, id).await?;
    let row: Option<(Option<String>, i64)> = sqlx::query_as(
        "SELECT body,revision FROM inbox.crm_inbox_drafts WHERE conversation_id=$1 AND member_id=$2",
    )
    .bind(id)
    .bind(me)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    let (body, revision) = row.unwrap_or((None, 0));
    Ok(Json(json!({"draft": {"body": body, "revision": revision}})))
}

pub async fn put(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    let id = access::id(&id)?;
    let Json(body) = body.map_err(|_| ApiError::invalid(DRAFT))?;
    let (text, base) = input(body)?;
    let mut tx = state.pool.begin().await?;
    let me = visible(&mut tx, &workspace, &session, id).await?;
    if text.is_some() {
        // The limit stops a new draft; one the member already has can always be saved.
        let full: bool = sqlx::query_scalar(
            "SELECT count(*) FILTER (WHERE conversation_id<>$3)>=$4 \
               AND NOT coalesce(bool_or(conversation_id=$3),false) \
             FROM inbox.crm_inbox_drafts WHERE workspace_id=$1 AND member_id=$2 AND body IS NOT NULL",
        )
        .bind(&workspace)
        .bind(me)
        .bind(id)
        .bind(MAX_DRAFTS)
        .fetch_one(&mut *tx)
        .await?;
        if full {
            return Err(ApiError::conflict(TOO_MANY));
        }
    }
    let updated: Option<i64> = sqlx::query_scalar(
        "UPDATE inbox.crm_inbox_drafts SET body=$3,revision=revision+1,updated_at=now() \
         WHERE conversation_id=$1 AND member_id=$2 AND revision=$4 RETURNING revision",
    )
    .bind(id)
    .bind(me)
    .bind(&text)
    .bind(base)
    .fetch_optional(&mut *tx)
    .await?;
    let revision = match (updated, base, &text) {
        (Some(revision), _, _) => revision,
        // Clearing from a window that never saw a draft is fine only when there is none.
        (None, 0, None) => match exists(&mut tx, id, me).await? {
            true => return Err(ApiError::stale(CHANGED)),
            false => 0,
        },
        (None, 0, Some(text)) => sqlx::query_scalar(
            "INSERT INTO inbox.crm_inbox_drafts (conversation_id,member_id,workspace_id,body) \
             VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING revision",
        )
        .bind(id)
        .bind(me)
        .bind(&workspace)
        .bind(text)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(ApiError::stale(CHANGED))?,
        _ => return Err(ApiError::stale(CHANGED)),
    };
    tx.commit().await?;
    Ok(Json(json!({"revision": revision})))
}

async fn exists(tx: &mut Transaction<'_, Postgres>, id: Uuid, member: Uuid) -> ApiResult<bool> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM inbox.crm_inbox_drafts \
           WHERE conversation_id=$1 AND member_id=$2)",
    )
    .bind(id)
    .bind(member)
    .fetch_one(&mut **tx)
    .await?)
}
