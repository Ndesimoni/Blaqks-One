//! `PUT /api/crm/platform/team/{id}/active`: the Owner suspends or reactivates a member.
//! Suspending signs them out at once and, before activation, cancels the invitation; a
//! person who never activated gets a new link instead of being switched on.
use super::{rows, target};
use crate::team::audit;
use crate::{
    auth::{protection, session::Session, sessions},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::ORGANISATION,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActiveRequest {
    version: i64,
    active: bool,
}

pub async fn set_active(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: Result<Json<ActiveRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    target::owner_session(&session)?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) = body.map_err(|_| {
        ApiError::invalid("Provide the member version and whether the account is active.")
    })?;
    let (mut tx, owner) = target::begin(&state, &session, true).await?;
    let (id, current) = target::lock(&mut tx, owner, &id, Some(request.version)).await?;
    if request.active && !current.accepted {
        return Err(ApiError::conflict(
            "This person has not activated their account. Send a new invitation link instead.",
        ));
    }
    sqlx::query("UPDATE crm_users SET active=$2,version=version+1 WHERE id=$1")
        .bind(id)
        .bind(request.active)
        .execute(&mut *tx)
        .await?;
    if !request.active {
        sessions::revoke_all(&mut tx, &[id]).await?;
        sqlx::query(
            "UPDATE crm_team_invitations SET revoked_at=now() \
             WHERE user_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL",
        )
        .bind(id)
        .execute(&mut *tx)
        .await?;
    }
    let action = if request.active {
        "updated"
    } else {
        "suspended"
    };
    audit::append(&mut tx, session.user.id, ORGANISATION, id, action).await?;
    let member = rows::one(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "member": member })))
}
