use crate::team::{access, account_type::seats, audit, members};
use crate::{
    auth::{
        protection,
        session::{self, Session},
    },
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
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
#[serde(deny_unknown_fields)]
pub struct RenewRequest {
    version: i64,
}

pub async fn renew(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<RenewRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let owner = access::owner(&state, &session, &workspace).await?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) =
        body.map_err(|_| ApiError::invalid("Provide the current member version."))?;
    let id = Uuid::parse_str(&id).map_err(|_| ApiError::invalid("Invalid member ID."))?;
    let mut transaction = state.pool.begin().await?;
    workspaces::lock(&mut transaction, &workspace).await?;
    access::lock_owner(&mut transaction, owner).await?;
    let target = sqlx::query_as::<_, (i64, bool)>(
        "SELECT version,accepted_at IS NULL FROM crm_users WHERE id=$1 AND deleted_at IS NULL AND \
         ((role='staff' AND owner_id=$2 AND workspace_id=$3) OR ($4 AND role='admin')) FOR UPDATE",
    )
    .bind(id)
    .bind(owner)
    .bind(&workspace)
    .bind(access::can_manage_admin(&session, &workspace))
    .fetch_optional(&mut *transaction)
    .await?
    .ok_or_else(ApiError::forbidden)?;
    if target.0 != request.version {
        return Err(ApiError::stale(
            "This member changed. Reload before renewing.",
        ));
    }
    if !target.1 {
        return Err(ApiError::conflict(
            "This account is already activated. Use account recovery instead.",
        ));
    }
    seats::ensure(&mut transaction, &workspace, Some(id)).await?;
    let token = session::random_token();
    let expires_at: String = sqlx::query_scalar(
        "UPDATE crm_team_invitations SET token_hash=$2,expires_at=now()+interval '48 hours', \
         consumed_at=NULL,revoked_at=NULL,created_by=$3 WHERE user_id=$1 AND owner_id=$4 AND workspace_id=$5 \
         RETURNING to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')",
    ).bind(id).bind(session::digest(&token)).bind(session.user.id).bind(owner).bind(&workspace)
        .fetch_optional(&mut *transaction).await?.ok_or_else(ApiError::forbidden)?;
    sqlx::query("UPDATE crm_users SET version=version+1 WHERE id=$1")
        .bind(id)
        .execute(&mut *transaction)
        .await?;
    audit::append(&mut transaction, session.user.id, &workspace, id, "invited").await?;
    transaction.commit().await?;
    Ok(Json(json!({"member":members::find(&state.pool,id).await?,
        "invitation":{"token":token,"expiresAt":expires_at}})))
}
