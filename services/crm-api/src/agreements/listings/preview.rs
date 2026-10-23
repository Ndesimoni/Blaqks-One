//! `POST /agreements/listing-shares/preview {recordId, exactLocation}`: exactly what the agent
//! will see before and after accepting, the photos and plans that go with it, the free-text
//! warnings and the `previewDigest` that sending repeats (what you reviewed is what is sent).
use super::{access, snapshot, view};
use crate::{
    agreements::wire,
    auth::session::Session,
    error::{ApiError, ApiResult},
    records::outside_facts,
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

const INVALID: &str = "Choose a listing to review.";

pub async fn preview(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::writer(&state, &session, &headers, &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let map = wire::exact(body, &["recordId", "exactLocation"], INVALID)?;
    let record = wire::uuid(wire::node(&map, "recordId")?).map_err(|_| ApiError::missing())?;
    let exact = map["exactLocation"]
        .as_bool()
        .ok_or(ApiError::invalid(INVALID))?;
    let mut tx = state.pool.begin().await?;
    let live = access::live(&mut tx, &workspace, session.user.id).await?;
    let outside = outside_facts::shareable(&mut tx, &workspace, &live, record).await?;
    let draft = snapshot::draft(&mut tx, &workspace, record, outside, exact).await?;
    tx.rollback().await?;
    let after = Value::Object(draft.facts.clone());
    let names = |kind: &str| -> Vec<&str> {
        let files = draft.files.iter().filter(|file| file.kind == kind);
        files.map(|file| file.name.as_str()).collect()
    };
    Ok(Json(json!({
        "before": view::basic(&after),
        "after": after,
        "files": {"photos": names("photo"), "floorPlans": names("floorPlan")},
        "exactLocation": exact,
        "warnings": draft.warnings,
        "previewDigest": draft.review,
    })))
}
