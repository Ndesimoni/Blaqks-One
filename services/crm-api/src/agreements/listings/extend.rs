//! `POST /agreements/listing-shares/{id}/extend {viewEndsOn}`: the sender or the sending
//! company's Admin moves an accepted share's last day later, never beyond 90 days from the
//! day of the extension. The event records the new end.
use super::{
    access::Viewer,
    dates,
    step::{self, NOT_OPEN},
    store,
};
use crate::{
    agreements::wire,
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::Value;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

pub async fn extend(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let Json(body) = body.map_err(|_| ApiError::invalid(dates::INVALID))?;
    let map = wire::exact(body, &["viewEndsOn"], dates::INVALID)?;
    let raw = map["viewEndsOn"]
        .as_str()
        .ok_or(ApiError::invalid(dates::INVALID))?;
    let mut step = step::begin(&state, &session, &headers, path, Viewer::Sender).await?;
    let end = dates::last_day(raw, OffsetDateTime::now_utc())?;
    if step.row.status != "accepted" {
        return step.refuse(NOT_OPEN).await;
    }
    let current = OffsetDateTime::parse(&step.row.view_ends_at, &Rfc3339)
        .map_err(|_| ApiError::invalid(dates::INVALID))?;
    if end <= current {
        return Err(ApiError::invalid(dates::NOT_LATER));
    }
    let end = dates::stamp(end)?;
    sqlx::query(
        "UPDATE agreements.crm_listing_shares SET view_ends_at=$2::timestamptz WHERE id=$1",
    )
    .bind(step.row.id)
    .bind(&end)
    .execute(&mut *step.tx)
    .await?;
    let by = Some((step.actor, "sender"));
    store::event(
        &mut step.tx,
        step.row.id,
        "extended",
        by,
        (None, Some(&end)),
    )
    .await?;
    step.finish().await
}
