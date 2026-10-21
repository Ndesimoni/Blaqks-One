//! `GET /channels` and `POST /channels` (docs/messaging-integrations-plan.md §4 X1):
//! list this company's connections and connect an account through the local stub.
use super::{
    access, crypto,
    model::{Channel, Provider},
    provider::{self, ConnectInput},
    store, store_write, wire,
};
use crate::{
    auth::session::Session,
    config::messaging_settings::MessagingKey,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

const CONNECTION: [&str; 5] = [
    "channel",
    "provider",
    "label",
    "externalAccountId",
    "credential",
];
pub const UNCONFIGURED: &str = "Channel connections are not configured.";

pub fn key(state: &AppState) -> ApiResult<&MessagingKey> {
    state.config.messaging.as_ref().ok_or(ApiError(
        StatusCode::SERVICE_UNAVAILABLE,
        UNCONFIGURED,
        "messaging_unconfigured",
    ))
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    access::ensure_reader(&state, &session, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let rows = store::list(&mut tx, &workspace).await?;
    tx.commit().await?;
    let channels: Vec<Value> = rows.iter().map(|row| row.view()).collect();
    Ok(Json(json!({ "channels": channels })))
}

pub async fn connect(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::ensure_admin(&state, &session, &headers, &workspace).await?;
    let key = key(&state)?.clone();
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    let input = wire::exact(body, &["connection"], wire::INVALID)?;
    let connection = wire::exact(
        wire::node(&input, "connection")?.clone(),
        &CONNECTION,
        wire::INVALID,
    )?;
    let channel = Channel::parse(&wire::text(wire::node(&connection, "channel")?, 20)?)
        .ok_or_else(|| ApiError::invalid("Choose a supported channel."))?;
    let provider = Provider::parse(&wire::text(wire::node(&connection, "provider")?, 20)?)
        .ok_or_else(|| ApiError::invalid("Choose a supported provider."))?;
    if !channel.allows(provider) {
        return Err(ApiError::invalid(
            "Choose a provider that supports this channel.",
        ));
    }
    // A Google mailbox holds a real refresh token, so it connects only through sign-in.
    if provider == Provider::Google {
        return Err(ApiError::invalid(
            "Connect a Google mailbox with Google sign-in.",
        ));
    }
    let label = wire::text(wire::node(&connection, "label")?, 80)?;
    let external = wire::text(wire::node(&connection, "externalAccountId")?, 160)?;
    let credential = wire::secret(wire::node(&connection, "credential")?, 4096)?;
    // A SendGrid account proves its key and domain with SendGrid (E3a); others use the stub.
    let account = if provider == Provider::Sendgrid {
        let config = &state.config.sendgrid;
        super::sendgrid::connect::account(config, &label, &external, &credential).await?
    } else {
        provider::adapter(channel)
            .connect(&ConnectInput {
                label: &label,
                external_account_id: &external,
                credential: &credential,
            })
            .map_err(ApiError::invalid)?
    };
    let id = Uuid::new_v4();
    let aad = crypto::aad(
        &workspace,
        &id.to_string(),
        provider.as_str(),
        channel.as_str(),
        key.version,
    );
    let sealed = crypto::seal(&key.bytes, &aad, credential.as_bytes())
        .map_err(|_| ApiError::invalid("The credential could not be secured."))?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    access::live_admin(&mut tx, &workspace, session.user.id).await?;
    if channel == Channel::Email {
        super::sendgrid::connect::ensure_one_system(&mut tx, &workspace, provider.as_str()).await?;
    }
    store::insert(
        &mut tx,
        &store::NewConnection {
            id,
            workspace_id: &workspace,
            channel: channel.as_str(),
            provider: provider.as_str(),
            external_account_id: &account.external_account_id,
            display_label: &account.label,
            owner_member_id: channel.owner_scoped(provider).then_some(session.user.id),
            sealed: &sealed,
            key_version: key.version,
            actor: session.user.id,
        },
    )
    .await?;
    store_write::event(&mut tx, &workspace, id, "connected", session.user.id).await?;
    let row = store::load(&mut tx, &workspace, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    tx.commit().await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({ "connection": row.view() })),
    ))
}
