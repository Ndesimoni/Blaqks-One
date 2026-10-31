//! Only the requester may propose terms for the currently selected property offer.
use super::{conversation_access, gate, limits, visibility};
use crate::{
    agreements::listings::market_propose,
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Input {
    pub terms: Value,
}
pub async fn propose(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    Json(input): Json<Input>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let user = gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, user.id).await?;
    let row = conversation_access::request(&mut tx, limits::missing_id(&id)?).await?;
    if row.member_id != user.id {
        return Err(ApiError::missing());
    }
    if row.paused_at.is_none() || row.closed_at.is_some() || row.expired {
        return Err(ApiError::conflict(
            "Choose a property before proposing co-broking.",
        ));
    }
    let chosen:Option<(Uuid,Uuid)>=sqlx::query_as("SELECT a.share_id,a.member_id FROM marketplace.crm_market_answers a JOIN marketplace.crm_market_requests r ON r.selected_answer_id=a.id WHERE r.id=$1 AND a.request_id=r.id AND a.state='chosen' FOR UPDATE OF a")
        .bind(row.id).fetch_optional(&mut *tx).await?;
    let (share, broker) = chosen.ok_or_else(ApiError::missing)?;
    visibility::visible(&mut tx, broker)
        .await?
        .ok_or_else(ApiError::missing)?;
    let agreement = market_propose::draft(&mut tx, share, &user, &input.terms).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({"agreement":agreement}))))
}
