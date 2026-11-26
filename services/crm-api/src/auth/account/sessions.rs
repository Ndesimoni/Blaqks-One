//! The caller's own sign-in sessions (account-self-service.md, endpoints 4 to 6). Lists
//! never include token hashes or CSRF tokens, and another member's session ID is
//! indistinguishable from an unknown one.
use super::events::{self, Action};
use crate::{
    auth::{protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

const STAMP: &str = "'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'";

#[derive(Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SessionView {
    id: Uuid,
    created_at: String,
    last_seen_at: String,
    expires_at: String,
    device: Option<String>,
    current: bool,
}

fn missing() -> ApiError {
    ApiError(StatusCode::NOT_FOUND, "Session not found.", "not_found")
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
) -> ApiResult<Json<Vec<SessionView>>> {
    let stamp = |column: &str| format!("to_char({column} AT TIME ZONE 'UTC',{STAMP}) AS {column}");
    let sql = format!(
        "SELECT id,{},{},{},device,token_hash=$2 AS current FROM crm_sessions \
         WHERE user_id=$1 AND expires_at>now() \
         ORDER BY token_hash=$2 DESC,last_seen_at DESC,id LIMIT 100",
        stamp("created_at"),
        stamp("last_seen_at"),
        stamp("expires_at"),
    );
    let rows = sqlx::query_as::<_, SessionView>(&sql)
        .bind(session.user.id)
        .bind(&session.token_hash)
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(rows))
}

pub async fn revoke(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let id = Uuid::parse_str(&id).map_err(|_| missing())?;
    if id == session.id {
        return Err(ApiError::invalid("Use Sign out on this device."));
    }
    let mut transaction = state.pool.begin().await?;
    let deleted = sqlx::query("DELETE FROM crm_sessions WHERE id=$1 AND user_id=$2")
        .bind(id)
        .bind(session.user.id)
        .execute(&mut *transaction)
        .await?;
    if deleted.rows_affected() != 1 {
        return Err(missing());
    }
    let (user, workspace) = (session.user.id, session.user.workspace_id.as_str());
    events::append(
        &mut transaction,
        user,
        user,
        workspace,
        Action::SessionRevoked,
    )
    .await?;
    transaction.commit().await?;
    Ok(Json(json!({"revoked": 1})))
}

pub async fn revoke_others(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let mut transaction = state.pool.begin().await?;
    let deleted = sqlx::query("DELETE FROM crm_sessions WHERE user_id=$1 AND token_hash<>$2")
        .bind(session.user.id)
        .bind(&session.token_hash)
        .execute(&mut *transaction)
        .await?;
    let (user, workspace) = (session.user.id, session.user.workspace_id.as_str());
    events::append(
        &mut transaction,
        user,
        user,
        workspace,
        Action::SessionsRevoked,
    )
    .await?;
    transaction.commit().await?;
    Ok(Json(json!({"revoked": deleted.rows_affected()})))
}
