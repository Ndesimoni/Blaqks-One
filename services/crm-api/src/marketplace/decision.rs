//! `POST /api/crm/workspaces/{company}/marketplace/decision` (packet MK1a): the Super Admin
//! approves or declines only the pending application, and revokes only an approved company.
//! Every decision is insert-only evidence with the day and the reviewer.
use super::{
    decisions::{reviewer, INVALID},
    events,
    state::{self as market, State},
};
use crate::{
    auth::{protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::{self, ORGANISATION},
};
use axum::{
    extract::{rejection::JsonRejection, Path, State as AxumState},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

const REASON: &str = "Give a reason of up to 500 characters.";
const NOT_PENDING: &str = "This application can no longer be decided.";
const NOT_APPROVED: &str = "Only an approved company can be revoked.";
const UNKNOWN: &str = "This application no longer exists.";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Decision {
    pub application_id: Uuid,
    pub decision: String,
    pub reason: Option<String>,
}

pub async fn decide(
    AxumState(state): AxumState<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(company): Path<String>,
    body: Result<Json<Decision>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    reviewer(&session)?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    if company == ORGANISATION {
        return Err(ApiError::missing());
    }
    let Json(request) = body.map_err(|_| ApiError::invalid(INVALID))?;
    if !["approved", "declined", "revoked"].contains(&request.decision.as_str()) {
        return Err(ApiError::invalid(INVALID));
    }
    let reason = reason(request.reason, &request.decision)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &company).await?;
    let owner = workspaces::owner_of(&mut tx, &company)
        .await
        .map_err(|_| ApiError::missing())?;
    let latest = market::latest(&mut tx, &company).await?;
    let current = market::state(&latest);
    let applied_by = match request.decision.as_str() {
        "revoked" => {
            if current != State::Approved {
                return Err(ApiError::conflict(NOT_APPROVED));
            }
            owner
        }
        _ => {
            let pending =
                current == State::Pending && latest.application_id == Some(request.application_id);
            if !pending {
                return Err(ApiError::conflict(NOT_PENDING));
            }
            sqlx::query_scalar::<_, Uuid>(
                "SELECT applied_by FROM marketplace.crm_market_applications \
                 WHERE id=$1 AND workspace_id=$2",
            )
            .bind(request.application_id)
            .bind(&company)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(|| ApiError::conflict(UNKNOWN))?
        }
    };
    let application = match request.decision.as_str() {
        "revoked" => None,
        _ => Some(request.application_id),
    };
    sqlx::query(
        "INSERT INTO marketplace.crm_market_decisions \
         (id,application_id,workspace_id,decision,reason,decided_by) VALUES ($1,$2,$3,$4,$5,$6)",
    )
    .bind(Uuid::new_v4())
    .bind(application)
    .bind(&company)
    .bind(&request.decision)
    .bind(&reason)
    .bind(session.user.id)
    .execute(&mut *tx)
    .await?;
    events::append(
        &mut tx,
        &company,
        session.user.id,
        applied_by,
        &request.decision,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "state": request.decision })))
}

/// A decline and a revocation always explain themselves; an approval may stay silent.
fn reason(text: Option<String>, decision: &str) -> ApiResult<Option<String>> {
    let text = text.map(|value| value.trim().to_owned());
    let text = text.filter(|value| !value.is_empty());
    if decision == "approved" {
        return Ok(text);
    }
    match text {
        Some(value) if value.chars().count() <= 500 => Ok(Some(value)),
        _ => Err(ApiError::invalid(REASON)),
    }
}
