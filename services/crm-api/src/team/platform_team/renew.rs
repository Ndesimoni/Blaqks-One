//! `POST /api/crm/platform/team/{id}/invitation`: the Owner sends a new activation link to
//! someone who has not activated yet (the link lasts 48 hours, and a cancelled invitation
//! can be sent again). Activated accounts get a password reset instead (credentials.rs).
use super::{rows, target};
use crate::team::audit;
use crate::{
    auth::{protection, session::Session},
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
pub struct RenewRequest {
    version: i64,
}

pub async fn renew(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: Result<Json<RenewRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    target::owner_session(&session)?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) = body.map_err(|_| ApiError::invalid("Provide the current version."))?;
    let (mut tx, owner) = target::begin(&state, &session, true).await?;
    let (id, current) = target::lock(&mut tx, owner, &id, Some(request.version)).await?;
    if current.accepted {
        return Err(ApiError::conflict(
            "This account is already activated. Reset the password instead.",
        ));
    }
    let (token, expires_at) = target::reissue(&mut tx, id, owner, session.user.id).await?;
    target::touch(&mut tx, id).await?;
    audit::append(&mut tx, session.user.id, ORGANISATION, id, "invited").await?;
    let member = rows::one(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({
        "member": member,
        "invitation": {"token": token, "expiresAt": expires_at},
    })))
}
