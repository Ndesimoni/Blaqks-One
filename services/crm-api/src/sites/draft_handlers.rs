use super::drafts::{self, Publish, Save};
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::Value;

pub async fn read(
    State(s): State<AppState>,
    session: Session,
    Path(w): Path<String>,
) -> ApiResult<Json<Value>> {
    Ok(Json(drafts::read(&s, &session, Some(&w)).await?))
}
pub async fn save(
    State(s): State<AppState>,
    session: Session,
    Path(w): Path<String>,
    h: HeaderMap,
    Json(body): Json<Save>,
) -> ApiResult<Json<Value>> {
    Ok(Json(drafts::save(&s, &session, &h, Some(&w), body).await?))
}
pub async fn publish(
    State(s): State<AppState>,
    session: Session,
    Path(w): Path<String>,
    h: HeaderMap,
    Json(body): Json<Publish>,
) -> ApiResult<Json<Value>> {
    Ok(Json(
        drafts::publish(&s, &session, &h, Some(&w), body).await?,
    ))
}
pub async fn platform_read(State(s): State<AppState>, session: Session) -> ApiResult<Json<Value>> {
    Ok(Json(drafts::read(&s, &session, None).await?))
}
pub async fn platform_save(
    State(s): State<AppState>,
    session: Session,
    h: HeaderMap,
    Json(body): Json<Save>,
) -> ApiResult<Json<Value>> {
    Ok(Json(drafts::save(&s, &session, &h, None, body).await?))
}
pub async fn platform_publish(
    State(s): State<AppState>,
    session: Session,
    h: HeaderMap,
    Json(body): Json<Publish>,
) -> ApiResult<Json<Value>> {
    Ok(Json(drafts::publish(&s, &session, &h, None, body).await?))
}
