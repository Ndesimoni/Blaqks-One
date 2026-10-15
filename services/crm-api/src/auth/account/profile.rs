//! `GET /auth/account` and `PATCH /auth/account` (account-self-service.md, endpoints 1
//! and 2). Members edit only their own name and phone; every other identity, access and
//! workspace field is never self-editable, and unknown fields are refused.
use super::{
    events::{self, Action},
    live,
};
use crate::{
    auth::{
        identity_rules,
        profile::{Profile, UserRow},
        protection,
        session::Session,
    },
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateRequest {
    version: i64,
    name: Option<String>,
    phone: Option<String>,
}

#[derive(FromRow)]
struct AccountRow {
    #[sqlx(flatten)]
    user: UserRow,
    version: i64,
    password_changed_at: Option<String>,
    owner_name: String,
}

/// The 409 for a concurrent change to the caller's own account.
pub fn stale() -> ApiError {
    ApiError(
        StatusCode::CONFLICT,
        "Your account changed elsewhere. Reload and try again.",
        "stale",
    )
}

async fn load<'e>(executor: impl sqlx::PgExecutor<'e>, user: Uuid) -> ApiResult<Value> {
    let row = sqlx::query_as::<_, AccountRow>(
        "SELECT u.*,to_char(c.password_changed_at AT TIME ZONE 'UTC', \
         'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS password_changed_at,o.name AS owner_name \
         FROM crm_user_profiles u JOIN crm_users c ON c.id=u.id \
         JOIN crm_user_profiles o ON o.id=COALESCE(u.owner_id,u.id) \
         WHERE u.id=$1 AND u.active AND u.owner_active",
    )
    .bind(user)
    .fetch_optional(executor)
    .await?
    .ok_or_else(ApiError::unauthorized)?;
    let workspace_id = row.user.workspace_id.clone();
    Ok(json!({
        "user": Profile::from(row.user),
        "version": row.version,
        "passwordChangedAt": row.password_changed_at,
        "team": {"workspaceId": workspace_id, "ownerName": row.owner_name},
    }))
}

pub async fn account(State(state): State<AppState>, session: Session) -> ApiResult<Json<Value>> {
    Ok(Json(load(&state.pool, session.user.id).await?))
}

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    body: Result<Json<UpdateRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) =
        body.map_err(|_| ApiError::invalid("Provide your account version and details."))?;
    let name = request.name.as_deref().map(str::trim);
    let phone = request.phone.as_deref().map(str::trim);
    if request.version < 1 || (name.is_none() && phone.is_none()) {
        return Err(ApiError::invalid(
            "Provide your account version and details.",
        ));
    }
    if name.is_some_and(|value| !identity_rules::name(value)) {
        return Err(ApiError::invalid("Use a name of 1 to 100 characters."));
    }
    if phone.is_some_and(|value| !identity_rules::phone(value)) {
        return Err(ApiError::invalid(
            "Provide a phone number including country code.",
        ));
    }
    let user = session.user.id;
    let workspace = session.user.workspace_id.as_str();
    let mut transaction = state.pool.begin().await?;
    workspaces::lock(&mut transaction, workspace).await?;
    if live::lock(&mut transaction, user).await?.version != request.version {
        return Err(stale());
    }
    sqlx::query(
        "UPDATE crm_users SET name=COALESCE($2,name),phone=COALESCE($3,phone), \
         version=version+1 WHERE id=$1",
    )
    .bind(user)
    .bind(name)
    .bind(phone)
    .execute(&mut *transaction)
    .await?;
    events::append(
        &mut transaction,
        user,
        user,
        workspace,
        Action::ProfileUpdated,
    )
    .await?;
    let account = load(&mut *transaction, user).await?;
    transaction.commit().await?;
    Ok(Json(account))
}
