//! `PATCH /api/crm/platform/team/{id}`: the Owner changes a member's position and access.
//! The change takes effect on the person's next request, since every platform handler
//! re-reads the saved levels; the team feed records that their access changed, not how.
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
use sqlx::types::Json as Stored;
use std::collections::BTreeMap;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EditRequest {
    version: i64,
    preset: String,
    access: BTreeMap<String, String>,
}

pub async fn edit(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: Result<Json<EditRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    target::owner_session(&session)?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) =
        body.map_err(|_| ApiError::invalid("Provide the version, position and access."))?;
    let (preset, access) = target::choice(&request.preset, &request.access)?;
    let (mut tx, owner) = target::begin(&state, &session, true).await?;
    let (id, _) = target::lock(&mut tx, owner, &id, Some(request.version)).await?;
    let before: (String, Stored<Value>) =
        sqlx::query_as("SELECT preset,access FROM crm_platform_access WHERE user_id=$1 FOR UPDATE")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;
    let changed = before.0 != preset.key() || before.1 .0 != access;
    if changed {
        sqlx::query(
            "UPDATE crm_platform_access SET preset=$2,access=$3,version=version+1, \
             updated_at=now() WHERE user_id=$1",
        )
        .bind(id)
        .bind(preset.key())
        .bind(Stored(&access))
        .execute(&mut *tx)
        .await?;
        target::touch(&mut tx, id).await?;
        audit::append(&mut tx, session.user.id, ORGANISATION, id, "access_changed").await?;
    }
    let member = rows::one(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "member": member })))
}
