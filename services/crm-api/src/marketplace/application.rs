//! `GET …/marketplace/status` and `POST …/marketplace/application` (packet MK1a). Status is
//! what every member reads; applying is the Admin's alone, once the checklist is met, and is
//! limited to five an hour per company. The platform sees the stored counts, never records.
use super::{
    eligibility::{self, Checklist},
    events, gate, profiles,
    state::{self as market, CompanyStatus, State},
};
use crate::{
    auth::{session::Session, throttle},
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, State as AxumState},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use time::OffsetDateTime;
use uuid::Uuid;

pub const INVALID: &str = "Provide valid marketplace details.";
const STAFF: &str = "Only your company's Admin can apply.";
const NOT_MET: &str = "The checklist is not complete yet.";
const PENDING: &str = "Your application is waiting for Blaqks One.";
const APPROVED: &str = "Your company is already on the marketplace.";
const REVOKED: &str = "Blaqks One has paused your company's marketplace access.";
const WAITING: &str = "A declined company can apply again after three days.";
const LIMITED: &str = "You have applied five times in the last hour. Try again later.";

pub async fn status(
    AxumState(state): AxumState<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    gate::reader(&state, &session, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let body = payload(&mut tx, &workspace, session.user.id).await?;
    tx.commit().await?;
    Ok(Json(body))
}

/// The whole status: the company's state and the caller's own membership.
pub async fn payload(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    member: Uuid,
) -> ApiResult<Value> {
    // Staff see which lines are met; only the Admin sees the counts (code review L8).
    let admin = crate::workspaces::member(tx, workspace, member).await?.role == "admin";
    let company = read(tx, workspace, admin).await?;
    let member = profiles::status(tx, member).await?;
    Ok(json!({ "company": company, "member": member }))
}

/// Re-read the status after a command and answer `{ "status": ... }`.
pub async fn reply(
    state: &AppState,
    workspace: &str,
    member: Uuid,
    code: StatusCode,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let mut tx = state.pool.begin().await?;
    let body = payload(&mut tx, workspace, member).await?;
    tx.commit().await?;
    Ok((code, Json(json!({ "status": body }))))
}

/// The company's state as the screen needs it.
pub async fn read(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    admin: bool,
) -> ApiResult<CompanyStatus> {
    let latest = market::latest(tx, workspace).await?;
    let checklist = eligibility::checklist(tx, workspace).await?;
    let switch = market::enabled(tx, workspace).await?;
    Ok(CompanyStatus::read(&latest, switch, checklist.view(admin)))
}

fn counts_json(checklist: Checklist) -> ApiResult<Value> {
    serde_json::to_value(checklist).map_err(|_| ApiError::invalid(INVALID))
}

pub async fn apply(
    AxumState(state): AxumState<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let user = gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    if user.role != "admin" {
        return Err(ApiError::denied(STAFF));
    }
    // Counted only for the Admin, so staff cannot use up the company's tries (review L7).
    let key = format!("marketplace-apply:{workspace}");
    throttle::consume_window(&state.pool, &key, 5, 3600, LIMITED, "rate_limited").await?;
    let latest = market::latest(&mut tx, &workspace).await?;
    let checklist = eligibility::checklist(&mut tx, &workspace).await?;
    if !checklist.met {
        return Err(ApiError::conflict(NOT_MET));
    }
    match market::state(&latest) {
        State::Pending => return Err(ApiError::conflict(PENDING)),
        State::Approved => return Err(ApiError::conflict(APPROVED)),
        State::Revoked => return Err(ApiError::conflict(REVOKED)),
        State::Declined
            if !market::wait_over(latest.decided_at.as_deref(), OffsetDateTime::now_utc()) =>
        {
            return Err(ApiError::conflict(WAITING))
        }
        _ => {}
    }
    sqlx::query(
        "INSERT INTO marketplace.crm_market_applications (id,workspace_id,applied_by,counts) \
         VALUES ($1,$2,$3,$4)",
    )
    .bind(Uuid::new_v4())
    .bind(&workspace)
    .bind(user.id)
    .bind(counts_json(checklist)?)
    .execute(&mut *tx)
    .await?;
    events::append(&mut tx, &workspace, user.id, user.id, "applied").await?;
    tx.commit().await?;
    reply(&state, &workspace, user.id, StatusCode::CREATED).await
}
