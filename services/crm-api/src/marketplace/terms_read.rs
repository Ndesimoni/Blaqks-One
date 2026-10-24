//! `GET …/marketplace/terms/{version}` (packet MK1b): one terms version, readable in full by any
//! member, with the publication consent, the four commitments and the draft notice.
use super::{gate, terms};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, State as AxumState},
    Json,
};
use serde_json::{json, Value};

pub async fn read(
    AxumState(state): AxumState<AppState>,
    session: Session,
    Path((workspace, version)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    gate::reader(&state, &session, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let found = terms::by_version(&mut tx, &version)
        .await?
        .ok_or_else(ApiError::missing)?;
    tx.commit().await?;
    Ok(Json(json!({ "terms": found })))
}
