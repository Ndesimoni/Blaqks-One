//! Blaqks One's Companies list (design queue item 33): each company
//! workspace with its Admin, status, seats in use against the limit and its marketplace state.
//! The rows come from the workspaces module and the state from the marketplace module; no
//! company's records are read.
use super::account_type::seats;
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    marketplace::state as market,
    state::AppState,
    workspaces::{self, platform::company_rows},
};
use axum::{extract::State, Json};
use serde::Serialize;
use serde_json::{json, Value};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Company {
    id: String,
    name: String,
    admin: String,
    status: String,
    created_on: String,
    seats_used: i64,
    seat_limit: Option<i32>,
    /// The company version the seat-limit change must send back.
    version: i64,
    marketplace: market::State,
}

pub async fn companies(State(state): State<AppState>, session: Session) -> ApiResult<Json<Value>> {
    if session.user.role != "super-admin" {
        return Err(ApiError::forbidden());
    }
    let mut transaction = state.pool.begin().await?;
    workspaces::platform::operator(&mut transaction, session.user.id).await?;
    transaction.commit().await?;
    let mut companies = Vec::new();
    for row in company_rows(&state.pool).await? {
        let (seats_used, seat_limit, version) = seats::usage(&state.pool, &row.id).await?;
        let mut transaction = state.pool.begin().await?;
        let latest = market::latest(&mut transaction, &row.id).await?;
        transaction.commit().await?;
        companies.push(Company {
            marketplace: market::state(&latest),
            seats_used,
            seat_limit,
            version,
            id: row.id,
            name: row.name,
            admin: row.admin,
            status: row.status,
            created_on: row.created_on,
        });
    }
    Ok(Json(json!({ "companies": companies })))
}
