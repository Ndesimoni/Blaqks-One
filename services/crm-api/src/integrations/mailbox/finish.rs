//! `POST /mailbox/google/finish`: the app posts back the `state` and `code` Google returned.
//! The request is consumed first and committed, so it is single-use even when Google
//! refuses; the mailbox is then stored for this member under the workspace lock.
use super::{ensure, live, unconfigured};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    integrations::{
        crypto,
        google::{grant, requests},
        handlers::key,
        revocation, store, store_write, wire,
    },
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

const EXPIRED: &str = "This Google sign-in has expired. Start again.";
const OTHER_MAILBOX: &str = "Disconnect your current mailbox before connecting another.";

pub async fn finish(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    ensure(&state, &session, Some(&headers), &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    let map = wire::exact(body, &["state", "code"], wire::INVALID)?;
    let text = |name: &str, max: usize| {
        map.get(name)
            .and_then(Value::as_str)
            .filter(|value| grant::token_shaped(value, max))
            .map(str::to_owned)
            .ok_or(ApiError::invalid(EXPIRED))
    };
    let (returned_state, code) = (text("state", 128)?, text("code", 1024)?);
    let google = state.config.google.clone().ok_or_else(unconfigured)?;
    let key = key(&state)?.clone();
    let owner = requests::Owner {
        workspace: &workspace,
        member: session.user.id,
        session: session.id,
    };
    let mut tx = state.pool.begin().await?;
    let verifier = requests::take(&mut tx, &key, &owner, &returned_state).await?;
    tx.commit().await?;
    let verifier = verifier.ok_or(ApiError::invalid(EXPIRED))?;
    let proven = grant::prove(&google, &code, &verifier).await?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    live(&mut tx, &workspace, session.user.id).await?;
    let existing = store::own_mailbox(&mut tx, &workspace, session.user.id).await?;
    if existing
        .as_ref()
        .is_some_and(|row| row.provider != "google" || row.external_account_id != proven.address)
    {
        return Err(ApiError::conflict(OTHER_MAILBOX));
    }
    revocation::cancel_for(&mut tx, &proven.address).await?;
    let id = existing.as_ref().map_or_else(Uuid::new_v4, |row| row.id);
    let aad = crypto::aad(&workspace, &id.to_string(), "google", "email", key.version);
    let sealed = crypto::seal(&key.bytes, &aad, proven.refresh_token.as_bytes())
        .map_err(|_| ApiError::invalid("The mailbox could not be secured."))?;
    let action = if existing.is_some() {
        store_write::set_connected(
            &mut tx,
            &workspace,
            id,
            &sealed,
            key.version,
            session.user.id,
        )
        .await?;
        "reconnected"
    } else {
        let label: String = proven.address.chars().take(80).collect();
        store::insert(
            &mut tx,
            &store::NewConnection {
                id,
                workspace_id: &workspace,
                channel: "email",
                provider: "google",
                external_account_id: &proven.address,
                display_label: &label,
                owner_member_id: Some(session.user.id),
                sealed: &sealed,
                key_version: key.version,
                actor: session.user.id,
            },
        )
        .await?;
        "connected"
    };
    store_write::event(&mut tx, &workspace, id, action, session.user.id).await?;
    let row = store::load(&mut tx, &workspace, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    tx.commit().await?;
    Ok(Json(json!({ "mailbox": row.view() })))
}
