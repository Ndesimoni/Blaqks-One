//! The platform queue (packet MK1a): only the Super Admin reaches it; everyone else gets the
//! shared not-found. The reviewer sees the company's name, type, age, who applied and the
//! counts, never its records.
use super::state::{self as market, State};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{Query, State as AxumState},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

pub(super) const INVALID: &str = "Provide a valid marketplace decision.";

#[derive(Deserialize)]
pub struct Filter {
    pub state: Option<String>,
}

#[derive(FromRow)]
struct Applied {
    id: Uuid,
    workspace_id: String,
    applied_by: Uuid,
    counts: sqlx::types::Json<Value>,
    applied_at: String,
}

/// Only the Super Admin may read the platform queue.
pub(super) fn reviewer(session: &Session) -> ApiResult<()> {
    if session.user.role == "super-admin" {
        Ok(())
    } else {
        Err(ApiError::missing())
    }
}

pub(super) fn stamp(column: &str) -> String {
    format!("to_char({column} AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')")
}

pub async fn list(
    AxumState(state): AxumState<AppState>,
    session: Session,
    Query(filter): Query<Filter>,
) -> ApiResult<Json<Value>> {
    reviewer(&session)?;
    let only_pending = match filter.state.as_deref() {
        None | Some("all") => false,
        Some("pending") => true,
        Some(_) => return Err(ApiError::invalid(INVALID)),
    };
    let mut tx = state.pool.begin().await?;
    let rows: Vec<Applied> = sqlx::query_as(&format!(
        "SELECT id,workspace_id,applied_by,counts,{} AS applied_at \
         FROM marketplace.crm_market_applications \
         ORDER BY created_at DESC,id DESC LIMIT 100",
        stamp("created_at")
    ))
    .fetch_all(&mut *tx)
    .await?;
    let mut applications = Vec::new();
    for row in rows {
        let latest = market::latest(&mut tx, &row.workspace_id).await?;
        let current = market::state(&latest);
        if only_pending && current != State::Pending {
            continue;
        }
        let company = workspaces::company::get(&mut *tx, &row.workspace_id).await?;
        let age = workspaces::company::age(&mut *tx, &row.workspace_id).await?;
        let owner = workspaces::owner_of(&mut tx, &row.workspace_id).await?;
        let applicant: Option<String> =
            sqlx::query_scalar("SELECT name FROM crm_user_profiles WHERE id=$1")
                .bind(row.applied_by)
                .fetch_optional(&mut *tx)
                .await?;
        let name = match company.display_name.clone() {
            Some(name) => name,
            None => member_name(&mut tx, owner).await?,
        };
        applications.push(json!({
            "id": row.id,
            "workspaceId": row.workspace_id,
            "company": name,
            "accountType": company.account_type,
            "companyCreatedAt": age.created_at,
            "appliedAt": row.applied_at,
            "appliedBy": applicant.unwrap_or_default(),
            "counts": row.counts.0,
            "state": current,
            "decidedAt": latest.decided_at,
            "reason": latest.reason,
        }));
    }
    tx.commit().await?;
    Ok(Json(json!({ "applications": applications })))
}

async fn member_name(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    id: Uuid,
) -> ApiResult<String> {
    Ok(
        sqlx::query_scalar("SELECT name FROM crm_user_profiles WHERE id=$1")
            .bind(id)
            .fetch_optional(&mut **tx)
            .await?
            .unwrap_or_default(),
    )
}
