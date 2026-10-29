use super::{model::PublishInput, prepare, store, validation, withdraw};
use crate::{
    auth::{protection, session::Session},
    error::ApiResult,
    media,
    state::AppState,
    workspaces,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::Value;

pub async fn publish(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    headers: HeaderMap,
    Json(input): Json<PublishInput>,
) -> ApiResult<Json<Value>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    validation::input(&input)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let _ = prepare::read(&mut tx, &workspace, session.user.id, &input).await?;
    let reserved = media::public_assets::reserve(
        &mut tx,
        &workspace,
        session.user.id,
        input.record_id,
        &input.photos,
        &input.floor_plans,
    )
    .await?;
    tx.commit().await?;
    media::copy_bytes::store(&state, &reserved).await?;
    let copies = media::copy_bytes::ids(&reserved);
    let result = async {
        let mut tx = state.pool.begin().await?;
        workspaces::lock(&mut tx, &workspace).await?;
        let prepared = prepare::read(&mut tx, &workspace, session.user.id, &input).await?;
        let published = store::publish(&mut tx, &workspace, &prepared, &input, &copies).await?;
        tx.commit().await?;
        Ok(Json(published))
    }
    .await;
    if result.is_err() {
        media::copy_bytes::discard(&state.pool, &copies).await?;
    }
    result
}
pub use withdraw::{list, withdraw};
