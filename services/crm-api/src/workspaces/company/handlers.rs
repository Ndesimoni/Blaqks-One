use super::{
    access, get, store,
    validation::{self, UpdateRequest},
    Company,
};
use crate::{
    auth::{protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};

pub async fn read(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Company>> {
    let mut transaction = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *transaction)
        .await?;
    access::member(&mut transaction, &workspace, session.user.id).await?;
    let company = get(&mut *transaction, &workspace).await?;
    transaction.commit().await?;
    Ok(Json(company))
}

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    headers: HeaderMap,
    body: Result<Json<UpdateRequest>, JsonRejection>,
) -> ApiResult<Json<Company>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    if session.user.role != "admin" || session.user.workspace_id != workspace {
        return Err(ApiError::forbidden());
    }
    let Json(mut request) = body.map_err(|_| validation::invalid())?;
    validation::prepare(&mut request)?;
    let mut transaction = state.pool.begin().await?;
    workspaces::lock(&mut transaction, &workspace).await?;
    access::owner(&mut transaction, &workspace, session.user.id).await?;
    let company =
        store::update_details(&mut transaction, &workspace, session.user.id, &request).await?;
    transaction.commit().await?;
    Ok(Json(company))
}
