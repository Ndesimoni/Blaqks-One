use super::{
    access,
    model::{EligibilityInput, SiteInput, SiteRow, COLUMNS},
    read, store, validation,
};
use crate::{
    auth::{protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

pub async fn config(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    let mut tx = state.pool.begin().await?;
    access::owner(&mut tx, &workspace, session.user.id).await?;
    let site = read::company(&mut tx, &workspace).await?;
    tx.commit().await?;
    Ok(Json(json!({"site":site})))
}
pub async fn update(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    headers: HeaderMap,
    Json(input): Json<SiteInput>,
) -> ApiResult<Json<Value>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    access::owner(&mut tx, &workspace, session.user.id).await?;
    let site = store::save(&mut tx, Some(&workspace), session.user.id, &input).await?;
    tx.commit().await?;
    Ok(Json(json!({"site":site})))
}
pub async fn platform(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Json(input): Json<SiteInput>,
) -> ApiResult<Json<Value>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, workspaces::ORGANISATION).await?;
    access::operator(&mut tx, session.user.id).await?;
    let site = store::save(&mut tx, None, session.user.id, &input).await?;
    tx.commit().await?;
    Ok(Json(json!({"site":site})))
}

pub async fn platform_config(
    State(state): State<AppState>,
    session: Session,
) -> ApiResult<Json<Value>> {
    let mut tx = state.pool.begin().await?;
    access::operator(&mut tx, session.user.id).await?;
    let row: Option<SiteRow> = sqlx::query_as(&format!(
        "SELECT {COLUMNS} FROM sites.crm_website_sites WHERE kind='platform'"
    ))
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(json!({"site":row})))
}
pub async fn eligibility(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    headers: HeaderMap,
    Json(input): Json<EligibilityInput>,
) -> ApiResult<Json<Value>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let host = input.host.as_deref().map(validation::host).transpose()?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    access::operator(&mut tx, session.user.id).await?;
    let row:SiteRow=sqlx::query_as(&format!("UPDATE sites.crm_website_sites SET entitled=$2,licence_verified=$3,host=coalesce($4,host),version=version+1,updated_at=now() WHERE workspace=$1 AND version=$5 RETURNING {COLUMNS}"))
        .bind(&workspace).bind(input.entitled).bind(input.licence_verified).bind(host).bind(input.version).fetch_optional(&mut *tx).await?.ok_or_else(||ApiError::stale("The website has changed. Reload and try again."))?;
    store::event(&mut tx, &row, session.user.id, "eligibility_changed").await?;
    tx.commit().await?;
    Ok(Json(json!({"site":row})))
}
