//! Sender-only review: the digest covers exact facts kept sealed for later agreement release.
use super::{answer_access, gate, limits, matching};
use crate::{
    agreements::listings,
    auth::session::Session,
    error::{ApiError, ApiResult},
    records::outside_facts,
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Input {
    record_id: String,
}
pub async fn preview(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    Json(input): Json<Input>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let user = gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, user.id).await?;
    let record = limits::missing_id(&input.record_id)?;
    let outside = outside_facts::shareable(&mut tx, &workspace, &user, record).await?;
    let row = answer_access::request(&mut tx, limits::missing_id(&id)?).await?;
    if row.workspace_id == workspace {
        return Err(ApiError::missing());
    }
    let checklist = matching::checklist(&row, &outside.facts);
    if checklist["matches"] != true {
        return Err(ApiError::conflict(
            "This property does not match the request.",
        ));
    }
    let draft = listings::market_draft(&mut tx, &workspace, record, outside, true).await?;
    let after = Value::Object(draft.facts);
    Ok(Json(
        json!({"previewDigest":draft.review,"before":after,"after":after,
        "files":{},"warnings":draft.warnings,"checklist":checklist}),
    ))
}
