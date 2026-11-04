use super::inspect;
use crate::team::{access, account_type::seats, audit};
use crate::{
    auth::{
        accounts, device, identity_rules, password, password_policy, profile::Profile, protection,
        session, sessions, throttle,
    },
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, State},
    http::{header, HeaderMap},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AcceptRequest {
    token: String,
    password: String,
    phone: Option<String>,
}

/// Activates the invited account and signs the person in, as sign-up does once the account
/// exists (design queue item 34: joining goes straight into the workspace). The session is
/// issued in the activation's transaction, for the account's own workspace.
pub async fn accept(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Result<Json<AcceptRequest>, JsonRejection>,
) -> ApiResult<(HeaderMap, Json<Value>)> {
    protection::origin(&state, &headers)?;
    let Json(request) =
        body.map_err(|_| ApiError::invalid("Provide an invitation and password."))?;
    throttle::invitation(&state.pool, &request.token).await?;
    // The new-password policy (account-self-service.md): rules first, the email once known.
    if !password_policy::strong(&request.password) {
        return Err(password_policy::weak());
    }
    if request
        .phone
        .as_ref()
        .is_some_and(|phone| !identity_rules::phone(phone))
    {
        return Err(ApiError::invalid(
            "Provide a phone number including country code.",
        ));
    }
    let invitation = inspect::find(&state.pool, &request.token).await?;
    password_policy::check(&request.password, None, &invitation.email)?;
    let permit = state
        .password_workers
        .acquire()
        .await
        .map_err(|_| ApiError::invalid("Authentication is temporarily unavailable."))?;
    let hash = password::hash(request.password).await?;
    drop(permit);
    let mut transaction = state.pool.begin().await?;
    workspaces::lock(&mut transaction, &invitation.workspace_id).await?;
    access::lock_owner(&mut transaction, invitation.owner_id).await?;
    let pending: bool = sqlx::query_scalar(
        "SELECT accepted_at IS NULL AND NOT active AND deleted_at IS NULL \
         FROM crm_users WHERE id=$1 FOR UPDATE",
    )
    .bind(invitation.user_id)
    .fetch_one(&mut *transaction)
    .await?;
    if !pending {
        return Err(inspect::unavailable());
    }
    if !seats::available(
        &mut transaction,
        &invitation.workspace_id,
        Some(invitation.user_id),
    )
    .await?
    {
        return Err(inspect::unavailable());
    }
    let consumed = sqlx::query(
        "UPDATE crm_team_invitations SET consumed_at=now() WHERE token_hash=$1 AND user_id=$2 \
         AND owner_id=$3 AND workspace_id=$4 AND expires_at>now() \
         AND consumed_at IS NULL AND revoked_at IS NULL",
    )
    .bind(session::digest(&request.token))
    .bind(invitation.user_id)
    .bind(invitation.owner_id)
    .bind(&invitation.workspace_id)
    .execute(&mut *transaction)
    .await?;
    if consumed.rows_affected() != 1 {
        return Err(inspect::unavailable());
    }
    sqlx::query(
        "UPDATE crm_users SET password_hash=$2,phone=COALESCE($3,phone),active=true, \
         accepted_at=now(),version=version+1 WHERE id=$1",
    )
    .bind(invitation.user_id)
    .bind(hash)
    .bind(request.phone)
    .execute(&mut *transaction)
    .await?;
    audit::append(
        &mut transaction,
        invitation.user_id,
        &invitation.workspace_id,
        invitation.user_id,
        "activated",
    )
    .await?;
    let agent = headers
        .get(header::USER_AGENT)
        .and_then(|value| value.to_str().ok());
    let label = device::label(agent);
    let issued = sessions::issue(&mut transaction, invitation.user_id, label.as_deref()).await?;
    let profile = accounts::live_profile(&mut transaction, invitation.user_id).await?;
    let company = workspaces::company::get(&mut *transaction, &profile.workspace_id).await?;
    transaction.commit().await?;
    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::SET_COOKIE,
        session::cookie(&issued.token, state.config.secure_cookie, false)
            .parse()
            .unwrap(),
    );
    Ok((
        response_headers,
        Json(json!({
            "ok": true,
            "user": Profile::from(profile),
            "csrfToken": issued.csrf_token,
            "company": company,
        })),
    ))
}
