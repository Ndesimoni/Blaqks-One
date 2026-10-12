use crate::{
    auth::{protection, throttle},
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, State},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InspectRequest {
    pub token: String,
}

#[derive(Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Invitation {
    #[serde(skip)]
    pub user_id: Uuid,
    #[serde(skip)]
    pub owner_id: Uuid,
    #[serde(skip)]
    pub workspace_id: String,
    pub name: String,
    pub email: String,
    pub phone: String,
    pub positions: sqlx::types::Json<Vec<String>>,
    pub role_id: String,
    pub owner_name: String,
    pub expires_at: String,
}

pub fn unavailable() -> ApiError {
    ApiError::invalid("This invitation is unavailable. Ask your Admin for a new link.")
}

pub fn token_valid(token: &str) -> bool {
    token.len() == 43
        && token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"-_".contains(&byte))
}

pub async fn find(pool: &sqlx::PgPool, token: &str) -> ApiResult<Invitation> {
    if !token_valid(token) {
        return Err(unavailable());
    }
    sqlx::query_as::<_, Invitation>(
        "SELECT u.id AS user_id,i.owner_id,i.workspace_id,u.name,u.email,u.phone,u.positions, \
         u.role AS role_id,o.name AS owner_name, \
         to_char(i.expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS expires_at \
         FROM crm_team_invitations i JOIN crm_users u ON u.id=i.user_id \
         JOIN crm_users o ON o.id=i.owner_id WHERE i.token_hash=$1 \
         AND i.expires_at>now() AND i.consumed_at IS NULL AND i.revoked_at IS NULL \
         AND u.accepted_at IS NULL AND NOT u.active AND o.active \
         AND u.deleted_at IS NULL AND o.deleted_at IS NULL \
         AND ((u.role='staff' AND u.owner_id=i.owner_id AND u.workspace_id=i.workspace_id) \
         OR (u.role='admin' AND o.role='super-admin' AND i.workspace_id='super-admin-workspace'))",
    ).bind(crate::auth::session::digest(token)).fetch_optional(pool).await?
        .ok_or_else(unavailable)
}

pub async fn inspect(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Result<Json<InspectRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    protection::origin(&state, &headers)?;
    let Json(request) = body.map_err(|_| unavailable())?;
    throttle::invitation(&state.pool, &request.token).await?;
    let invitation = find(&state.pool, &request.token).await?;
    Ok(Json(json!({"invitation":invitation})))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invitation_tokens_require_complete_url_safe_secrets() {
        assert!(token_valid(&"a".repeat(43)));
        assert!(!token_valid(&"a".repeat(42)));
        assert!(!token_valid(&"/".repeat(43)));
    }
}
