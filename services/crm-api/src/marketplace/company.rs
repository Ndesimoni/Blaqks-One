//! `PUT …/marketplace/company` (review amendment 2): the company's Admin turns the marketplace
//! on or off for the whole company under the workspace lock. There is no row until the first
//! change, and no row means on. Every change writes the history row and an event.
use super::{
    events, gate,
    state::{self as market, State},
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State as AxumState},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

const INVALID: &str = "Provide a valid marketplace setting.";
const ADMIN: &str = "Only your company's Admin can change this setting.";
const NOT_APPROVED: &str = "Your company is not approved for the marketplace yet.";
const STALE: &str = "Your company's marketplace setting changed. Reload and try again.";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Switch {
    pub enabled: bool,
    pub expected_version: i64,
}

pub async fn switch(
    AxumState(state): AxumState<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Switch>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let Json(request) = body.map_err(|_| ApiError::invalid(INVALID))?;
    if request.expected_version < 0 {
        return Err(ApiError::invalid(INVALID));
    }
    let mut tx = state.pool.begin().await?;
    let user = gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    if user.role != "admin" {
        return Err(ApiError::denied(ADMIN));
    }
    let latest = market::latest(&mut tx, &workspace).await?;
    if market::state(&latest) != State::Approved {
        return Err(ApiError::conflict(NOT_APPROVED));
    }
    let current: Option<(bool, i64)> = sqlx::query_as(
        "SELECT enabled,version FROM marketplace.crm_market_companies WHERE workspace_id=$1",
    )
    .bind(&workspace)
    .fetch_optional(&mut *tx)
    .await?;
    let saved = match current {
        None => {
            if request.expected_version != 0 {
                return Err(ApiError::stale(STALE));
            }
            insert(&mut tx, &workspace, user.id, request.enabled, 1).await?;
            (request.enabled, 1)
        }
        Some((enabled, version)) => {
            if version != request.expected_version {
                return Err(ApiError::stale(STALE));
            }
            if enabled == request.enabled {
                (enabled, version)
            } else {
                sqlx::query(
                    "UPDATE marketplace.crm_market_companies SET enabled=$2,version=version+1, \
                     changed_by=$3,changed_at=now() WHERE workspace_id=$1",
                )
                .bind(&workspace)
                .bind(request.enabled)
                .bind(user.id)
                .execute(&mut *tx)
                .await?;
                noted(&mut tx, &workspace, user.id, request.enabled).await?;
                (request.enabled, version + 1)
            }
        }
    };
    tx.commit().await?;
    Ok(Json(json!({
        "company": { "enabled": saved.0, "version": saved.1 }
    })))
}

async fn insert(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    actor: Uuid,
    enabled: bool,
    version: i64,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO marketplace.crm_market_companies \
         (workspace_id,enabled,version,changed_by) VALUES ($1,$2,$3,$4)",
    )
    .bind(workspace)
    .bind(enabled)
    .bind(version)
    .bind(actor)
    .execute(&mut **tx)
    .await?;
    noted(tx, workspace, actor, enabled).await
}

/// The history row and the redacted event of one change.
async fn noted(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    actor: Uuid,
    enabled: bool,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO marketplace.crm_market_company_events (id,workspace_id,enabled,changed_by) \
         VALUES ($1,$2,$3,$4)",
    )
    .bind(Uuid::new_v4())
    .bind(workspace)
    .bind(enabled)
    .bind(actor)
    .execute(&mut **tx)
    .await?;
    let action = if enabled {
        "switched_on"
    } else {
        "switched_off"
    };
    events::append(tx, workspace, actor, actor, action).await
}
