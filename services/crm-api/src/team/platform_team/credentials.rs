//! The Owner controls a team member's sign-in without ever seeing their password (BO1b,
//! owner 2026-11-05). `POST /api/crm/platform/team/{id}/sign-out` ends every session at
//! once. `POST /api/crm/platform/team/{id}/password-reset` makes the current password
//! unusable, ends every session and issues a one-time link on the member's invitation, so
//! they choose a new password on the activation screen. No email is sent: the Owner shares
//! the link. Both are account events with the Owner as actor, never the link or password.
use super::{rows, target};
use crate::{
    auth::{
        account::events::{self, Action},
        protection,
        session::Session,
        sessions,
    },
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

pub async fn sign_out(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    target::owner_session(&session)?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let (mut tx, owner) = target::begin(&state, &session, true).await?;
    let (id, _) = target::lock(&mut tx, owner, &id, None).await?;
    let ended = sessions::revoke_all(&mut tx, &[id]).await?;
    events::append(
        &mut tx,
        id,
        session.user.id,
        ORGANISATION,
        Action::SessionsRevoked,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "signedOut": ended })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ResetRequest {
    version: i64,
}

pub async fn password_reset(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: Result<Json<ResetRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    target::owner_session(&session)?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) = body.map_err(|_| ApiError::invalid("Provide the current version."))?;
    let (mut tx, owner) = target::begin(&state, &session, true).await?;
    let (id, current) = target::lock(&mut tx, owner, &id, Some(request.version)).await?;
    if !current.accepted {
        return Err(ApiError::conflict(
            "This person has not activated their account. Send a new invitation link instead.",
        ));
    }
    if !current.active {
        return Err(ApiError::conflict(
            "Reactivate this person before resetting their password.",
        ));
    }
    // Back to a pending activation: the stored hash is gone and only the new link signs in.
    sqlx::query(
        "UPDATE crm_users SET password_hash='',active=false,accepted_at=NULL, \
         version=version+1 WHERE id=$1",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;
    sessions::revoke_all(&mut tx, &[id]).await?;
    let (token, expires_at) = target::reissue(&mut tx, id, owner, session.user.id).await?;
    events::append(
        &mut tx,
        id,
        session.user.id,
        ORGANISATION,
        Action::PasswordReset,
    )
    .await?;
    let member = rows::one(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({
        "member": member,
        "invitation": {"token": token, "expiresAt": expires_at},
    })))
}
