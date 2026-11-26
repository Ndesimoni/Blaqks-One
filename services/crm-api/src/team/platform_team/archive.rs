//! `DELETE /api/crm/platform/team/{id}`: the Owner archives a member after typing their
//! email, as with a company archive. The account stays stored, read-only and signed out;
//! any open invitation ends. Platform staff hold no records, so nothing else moves.
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
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ArchiveRequest {
    version: i64,
    confirmation_email: String,
}

pub async fn archive(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: Result<Json<ArchiveRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    target::owner_session(&session)?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) =
        body.map_err(|_| ApiError::invalid("Provide the reviewed version and email."))?;
    let (mut tx, owner) = target::begin(&state, &session, true).await?;
    let (id, current) = target::lock(&mut tx, owner, &id, Some(request.version)).await?;
    if current.email != request.confirmation_email.trim().to_lowercase() {
        return Err(ApiError::invalid(
            "Type the account email exactly to confirm archival.",
        ));
    }
    sqlx::query("UPDATE crm_users SET active=false,deleted_at=now(),version=version+1 WHERE id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    sessions::revoke_all(&mut tx, &[id]).await?;
    sqlx::query(
        "UPDATE crm_team_invitations SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;
    audit::append(&mut tx, session.user.id, ORGANISATION, id, "archived").await?;
    let member = rows::one(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({"archived": true, "member": member})))
}
