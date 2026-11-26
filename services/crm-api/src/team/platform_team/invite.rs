//! `POST /api/crm/platform/team`: the Owner invites a Blaqks One team member. The pending
//! `platform` account, its access and the invitation are written in one transaction; the
//! person activates by the link and sets a password, as every invited member does.
use super::{rows, target};
use crate::team::{audit, invitations::store};
use crate::{
    auth::{identity_rules, protection, session, session::Session, throttle},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::ORGANISATION,
};
use axum::{
    extract::{rejection::JsonRejection, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InviteRequest {
    name: String,
    email: String,
    phone: String,
    preset: String,
    access: BTreeMap<String, String>,
}

pub async fn invite(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    body: Result<Json<InviteRequest>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    target::owner_session(&session)?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) = body.map_err(|_| ApiError::invalid("Provide valid invitation details."))?;
    let name = request.name.trim();
    let email = request.email.trim().to_lowercase();
    let phone = request.phone.trim();
    identity_rules::identity(name, &email, phone)?;
    let (preset, access) = target::choice(&request.preset, &request.access)?;
    throttle::consume_window(
        &state.pool,
        "team:invitation:day:platform",
        20,
        86_400,
        "Too many invitations. Try again later.",
        "rate_limited",
    )
    .await?;
    let (mut tx, owner) = target::begin(&state, &session, true).await?;
    let id = Uuid::new_v4();
    let inserted: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO crm_users (id,name,email,phone,password_hash,role,active,owner_id, \
         workspace_id,accepted_at) VALUES ($1,$2,$3,$4,'','platform',false,$5,$6,NULL) \
         ON CONFLICT (email) DO NOTHING RETURNING id",
    )
    .bind(id)
    .bind(name)
    .bind(&email)
    .bind(phone)
    .bind(owner)
    .bind(ORGANISATION)
    .fetch_optional(&mut *tx)
    .await?;
    if inserted.is_none() {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "The invitation could not be created.",
            "invitation_unavailable",
        ));
    }
    sqlx::query("INSERT INTO crm_platform_access (user_id,preset,access) VALUES ($1,$2,$3)")
        .bind(id)
        .bind(preset.key())
        .bind(sqlx::types::Json(&access))
        .execute(&mut *tx)
        .await?;
    let token = session::random_token();
    let actor = session.user.id;
    let expires_at = store::issue(&mut tx, &token, id, owner, ORGANISATION, actor).await?;
    audit::append(&mut tx, actor, ORGANISATION, id, "invited").await?;
    let member = rows::one(&mut tx, id).await?;
    tx.commit().await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "member": member,
            "invitation": {"token": token, "expiresAt": expires_at},
        })),
    ))
}
