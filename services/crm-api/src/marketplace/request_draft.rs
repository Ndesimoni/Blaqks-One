//! `GET …/marketplace/requests/draft?clientId=` (packet MK2): the requirements of one of the
//! poster's clients, pre-filled into the form. The read answers only the marketplace allowlist
//! (`records::market_requirements`), never the client's name or contact details.
use super::{gate, limits};
use crate::{
    auth::session::Session, error::ApiResult, records::market_requirements, state::AppState,
};
use axum::{
    extract::{Path, Query, State as AxumState},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Draft {
    pub client_id: String,
}

pub async fn draft(
    AxumState(state): AxumState<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    Query(query): Query<Draft>,
) -> ApiResult<Json<Value>> {
    gate::reader(&state, &session, &workspace).await?;
    let client = limits::missing_id(&query.client_id)?;
    let mut tx = state.pool.begin().await?;
    let user = gate::live_member(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, user.id).await?;
    let requirements = market_requirements::read(&mut tx, &workspace, &user, client).await?;
    tx.commit().await?;
    Ok(Json(json!({ "requirements": requirements })))
}
