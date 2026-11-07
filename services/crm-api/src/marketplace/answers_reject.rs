//! Rejection ends its introduction and frees its active slot atomically.
use super::{answer_access, gate, limits};
use crate::{
    agreements::listings,
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;
pub async fn reject(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id, answer)): Path<(String, String, String)>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let user = gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, user.id).await?;
    let id = limits::missing_id(&id)?;
    let answer = limits::missing_id(&answer)?;
    let row = answer_access::request(&mut tx, id).await?;
    if row.member_id != user.id {
        return Err(ApiError::missing());
    }
    let share:Uuid=sqlx::query_scalar("SELECT share_id FROM marketplace.crm_market_answers WHERE id=$1 AND request_id=$2 AND state='waiting' FOR UPDATE")
        .bind(answer).bind(id).fetch_optional(&mut *tx).await?.ok_or_else(ApiError::missing)?;
    listings::marketplace::end(&mut tx, share, user.id).await?;
    sqlx::query("UPDATE marketplace.crm_market_answers SET state='not_a_match',decided_at=now() WHERE id=$1")
        .bind(answer).execute(&mut *tx).await?;
    super::events::append(&mut tx, &workspace, user.id, user.id, "answer_rejected").await?;
    tx.commit().await?;
    Ok(Json(json!({})))
}
