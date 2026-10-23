//! `POST /agreements/recipients` (docs/agreements-design.md §13): finds the named recipient
//! of a new agreement by their exact sign-in email. It answers only for an active member of
//! another live company (the same rule `store::ensure_recipient` applies when the draft is
//! written) and returns just their IDs, name and company name. Every other address, the
//! caller's own company and the Super Admin get one identical not-found, and there is no
//! partial search, so the directory cannot be browsed. Each member may look up 20 addresses
//! an hour.
use super::{access, parties, wire};
use crate::{
    auth::{identity_rules, session::Session, throttle},
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

pub const NO_MATCH: &str = "No active member of another company uses this email.";
pub const LOOKUPS: &str = "You have looked up 20 agents in the last hour. Try again later.";

#[derive(sqlx::FromRow)]
struct Found {
    id: Uuid,
    workspace_id: String,
    name: String,
}

fn no_match() -> ApiError {
    ApiError(StatusCode::NOT_FOUND, NO_MATCH, "not_found")
}

pub async fn find(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    // The lookup confirms a name and a company, so it is rate limited (R2 security review 3).
    let key = format!("agreement-recipients:{}", session.user.id);
    throttle::consume_window(&state.pool, &key, 20, 3600, LOOKUPS, "rate_limited").await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    let input = wire::exact(body, &["email"], wire::INVALID)?;
    let email = wire::text(wire::node(&input, "email")?, 254)?.to_lowercase();
    if !identity_rules::email(&email) {
        return Err(ApiError::invalid(wire::INVALID));
    }
    let mut tx = state.pool.begin().await?;
    let found = sqlx::query_as::<_, Found>(
        "SELECT id, workspace_id, name FROM crm_user_profiles
         WHERE email=$1 AND active AND owner_active AND role<>'super-admin' AND workspace_id<>$2",
    )
    .bind(&email)
    .bind(&workspace)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(no_match)?;
    let company = parties::company(&mut tx, &found.workspace_id).await?;
    tx.commit().await?;
    Ok(Json(json!({
        "recipient": {
            "workspaceId": found.workspace_id,
            "memberId": found.id,
            "name": found.name,
            "company": company,
        }
    })))
}
