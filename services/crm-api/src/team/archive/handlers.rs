use super::{scope, snapshot, store};
use crate::{
    auth::{protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ArchiveRequest {
    pub version: i64,
    pub confirmation_email: String,
    pub team_fingerprint: String,
}

pub async fn preview(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    let id = Uuid::parse_str(&id).map_err(|_| ApiError::invalid("Invalid member ID."))?;
    let scope = scope::scope(&state, &session, workspace, id).await?;
    let mut transaction = state.pool.begin().await?;
    scope::lock(&mut transaction, &scope).await?;
    let snapshot = snapshot::read(
        &mut transaction,
        id,
        scope.owner,
        &scope.workspace,
        scope.manages_admin,
    )
    .await?;
    transaction.commit().await?;
    Ok(Json(json!(snapshot)))
}

pub async fn archive(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<ArchiveRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) =
        body.map_err(|_| ApiError::invalid("Review the account before archiving."))?;
    if request.version < 1
        || request.confirmation_email.len() > 254
        || request.team_fingerprint.len() != 64
    {
        return Err(ApiError::invalid(
            "Provide the reviewed version, email and team fingerprint.",
        ));
    }
    let id = Uuid::parse_str(&id).map_err(|_| ApiError::invalid("Invalid member ID."))?;
    let scope = scope::scope(&state, &session, workspace, id).await?;
    let result = store::archive(&state.pool, session.user.id, id, &scope, request).await?;
    crate::integrations::revoke_soon(&state);
    Ok(Json(result))
}
