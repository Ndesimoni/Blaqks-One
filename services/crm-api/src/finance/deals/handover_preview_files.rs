//! `GET /finance/handovers/{id}/preview/files/{file}` (agreements design §18, H3
//! amendment 8): a photo or floor plan of the hand-over's property, for exactly the people
//! who may open the preview, and only a file that property's listing names. Anything else
//! is the same 404.
use super::{
    gate::{self, Need},
    handover_preview::reviewable,
    row,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    records::handover_listing,
    state::AppState,
};
use axum::{
    extract::{Path, State},
    response::Response,
};

pub async fn file(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id, file)): Path<(String, String, String)>,
) -> ApiResult<Response> {
    gate::reader(&state, &session, &workspace, Need::Module).await?;
    let (id, file) = (gate::id(&id)?, gate::id(&file)?);
    let user = &session.user;
    let mut tx = state.pool.begin().await?;
    let request = reviewable(&mut tx, &workspace, id, user).await?;
    let deal = row::for_preview(&mut tx, &workspace, user.id, request.deal_id).await?;
    let listing = handover_listing::listing(&mut tx, &workspace, deal.property_ref.as_deref())
        .await?
        .ok_or_else(ApiError::missing)?;
    let response = handover_listing::file(&state, &mut tx, (&workspace, &listing), file)
        .await?
        .ok_or_else(ApiError::missing)?;
    tx.commit().await?;
    Ok(response)
}
