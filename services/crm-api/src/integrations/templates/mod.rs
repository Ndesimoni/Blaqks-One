//! WhatsApp templates of the company's Twilio account (packet W1b, design §8 and §18) under
//! `/api/crm/workspaces/{ws}/whatsapp-templates`, for the owning Admin. `GET` lists every
//! template with its approval; `POST /refresh` reads Twilio again. The composer reads only
//! offered templates, through `integrations::whatsapp`.
pub mod store;
pub mod sync;

use crate::{
    auth::session::Session,
    config::{messaging_settings::MessagingKey, twilio_settings::TwilioConfig},
    error::{ApiError, ApiResult},
    integrations::{
        access, google::oauth::Failure, handlers::key, numbers::senders as account, twilio, wire,
    },
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

const NOT_LISTED: &str =
    "Twilio did not list this account's templates. Check that WhatsApp is enabled for the account in Twilio.";

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    access::ensure_reader(&state, &session, &workspace).await?;
    Ok(Json(view(&state.pool, &workspace).await?))
}

pub async fn refresh(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::ensure_admin(&state, &session, &headers, &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    wire::exact(body, &[], wire::INVALID)?;
    let key = key(&state)?;
    let mut tx = state.pool.begin().await?;
    access::live_admin(&mut tx, &workspace, session.user.id).await?;
    let row = account::live(&mut tx, &workspace)
        .await?
        .ok_or(ApiError::invalid(account::NO_TWILIO))?;
    tx.commit().await?;
    let config = &state.config.twilio;
    let synced = sync::sync(
        &state.pool,
        key,
        config,
        &workspace,
        row.id,
        Some(session.user.id),
    );
    match synced.await? {
        Ok(()) => Ok(Json(view(&state.pool, &workspace).await?)),
        Err(Failure::Refused) => Err(ApiError::invalid(account::RECONNECT)),
        Err(Failure::Invalid) => Err(ApiError::invalid(NOT_LISTED)),
        Err(Failure::Unavailable) => Err(twilio::connect::unavailable()),
    }
}

/// Right after a Twilio account connects: `synced` or `failed` (the Admin may refresh).
pub async fn after_connect(
    pool: &PgPool,
    key: &MessagingKey,
    config: &TwilioConfig,
    workspace: &str,
    connection: Uuid,
    actor: Uuid,
) -> &'static str {
    let actor = Some(actor);
    match sync::sync(pool, key, config, workspace, connection, actor).await {
        Ok(Ok(())) => "synced",
        _ => "failed",
    }
}

/// The live connection's templates and when they were last read.
async fn view(pool: &PgPool, workspace: &str) -> ApiResult<Value> {
    let mut tx = pool.begin().await?;
    let Some(row) = account::live(&mut tx, workspace).await? else {
        tx.commit().await?;
        return Ok(json!({"templates": [], "syncedAt": null, "checkedAt": null, "sync": null}));
    };
    let templates = store::all(&mut tx, workspace, row.id).await?;
    let (synced, checked, ok): (Option<String>, Option<String>, bool) = sqlx::query_as(
        "SELECT to_char(templates_synced_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), \
           to_char(templates_checked_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), \
           COALESCE(templates_synced_at=templates_checked_at,false) \
         FROM integrations.crm_channel_connections WHERE id=$1 AND workspace_id=$2",
    )
    .bind(row.id)
    .bind(workspace)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    // The last read either stored the templates (both times equal) or failed.
    let sync = match (checked.is_some(), ok) {
        (false, _) => Value::Null,
        (true, true) => json!("ok"),
        (true, false) => json!("failed"),
    };
    let templates: Vec<Value> = templates.iter().map(store::Template::admin_view).collect();
    Ok(json!({"templates": templates, "syncedAt": synced, "checkedAt": checked, "sync": sync}))
}
