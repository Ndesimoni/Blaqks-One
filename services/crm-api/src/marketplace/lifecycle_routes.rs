//! Selection pauses intake, not deal completion. Reopening preserves expiry and evidence.
use super::{conversation_access as access, gate, limits, notices};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Select {
    pub answer_id: Uuid,
    pub expected_version: i64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Reopen {
    pub expected_version: i64,
}

pub async fn select(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    Json(input): Json<Select>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, session.user.id).await?;
    let row = access::request(&mut tx, limits::missing_id(&id)?).await?;
    if row.member_id != session.user.id {
        return Err(ApiError::missing());
    }
    access::open(&row)?;
    if row.version != input.expected_version {
        return Err(ApiError::conflict(
            "This request changed. Refresh it before choosing.",
        ));
    }
    let offer: Option<(Uuid, Uuid)> = sqlx::query_as("SELECT member_id,share_id FROM marketplace.crm_market_answers WHERE id=$1 AND request_id=$2 AND state='waiting' FOR UPDATE")
        .bind(input.answer_id).bind(row.id).fetch_optional(&mut *tx).await?;
    let (broker, share) =
        offer.ok_or_else(|| ApiError::conflict("Choose an active property offer."))?;
    if !crate::agreements::listings::marketplace::live(&mut tx, share).await? {
        return Err(ApiError::conflict(
            "This property offer is no longer available.",
        ));
    }
    sqlx::query(
        "UPDATE marketplace.crm_market_answers SET state='chosen',decided_at=now() WHERE id=$1",
    )
    .bind(input.answer_id)
    .execute(&mut *tx)
    .await?;
    super::visibility::visible(&mut tx, broker)
        .await?
        .ok_or_else(ApiError::missing)?;
    sqlx::query("UPDATE marketplace.crm_market_requests SET paused_at=now(),selected_answer_id=$2,version=version+1,updated_at=now() WHERE id=$1")
        .bind(row.id).bind(input.answer_id).execute(&mut *tx).await?;
    notices::append(
        &mut tx,
        row.id,
        Some(broker),
        "selected_other",
        row.version + 1,
    )
    .await?;
    super::events::append(
        &mut tx,
        &workspace,
        session.user.id,
        session.user.id,
        "request_selected",
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({"state":"paused","version":row.version+1})))
}

pub async fn reopen(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    Json(input): Json<Reopen>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, session.user.id).await?;
    let row = access::request(&mut tx, limits::missing_id(&id)?).await?;
    if row.member_id != session.user.id {
        return Err(ApiError::missing());
    }
    if row.version != input.expected_version
        || row.paused_at.is_none()
        || row.expired
        || row.closed_at.is_some()
    {
        return Err(ApiError::conflict(
            "Only a current paused request can be reopened. Refresh or post a new request.",
        ));
    }
    super::lifecycle_store::ensure_reopen(&mut tx, row.id).await?;
    super::lifecycle_store::end_offers(&mut tx, row.id, session.user.id).await?;
    sqlx::query("UPDATE marketplace.crm_market_requests SET paused_at=NULL,selected_answer_id=NULL,round=round+1,version=version+1,updated_at=now() WHERE id=$1")
        .bind(row.id).execute(&mut *tx).await?;
    notices::append(&mut tx, row.id, None, "reopened", row.version + 1).await?;
    super::events::append(
        &mut tx,
        &workspace,
        session.user.id,
        session.user.id,
        "request_reopened",
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({"state":"open","version":row.version+1})))
}
