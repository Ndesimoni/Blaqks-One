//! `GET /whatsapp-numbers/senders` (owning Admin, design §4 and §16): the WhatsApp senders
//! of the company's Twilio account, read from Twilio with the sealed token and outside any
//! lock. `available` means `ONLINE` and not active in any company; which company holds a
//! number is never said.
use super::store;
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    integrations::{
        access, credential, google::oauth::Failure, handlers::key, model::ConnectionRow,
        store as connections, store_write, twilio,
    },
    state::AppState,
    workspaces,
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const NO_TWILIO: &str = "Connect the company's Twilio account first.";
const NOT_LISTED: &str =
    "Twilio did not list this account's WhatsApp senders. Check that WhatsApp is enabled for the account in Twilio.";
pub const RECONNECT: &str =
    "Twilio no longer accepts the company's Auth Token. Reconnect the Twilio account.";

/// The company's live Twilio connection.
pub async fn live(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
) -> ApiResult<Option<ConnectionRow>> {
    let id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM integrations.crm_channel_connections
         WHERE workspace_id=$1 AND provider='twilio' AND state<>'disconnected'",
    )
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?;
    match id {
        Some(id) => connections::load(tx, workspace, id).await,
        None => Ok(None),
    }
}

/// The account's senders and the connection they belong to. A refused token marks the
/// connection `reconnect_required` with `actor` as the one who found it, as a refused
/// send will (design §5).
pub async fn read(
    state: &AppState,
    workspace: &str,
    actor: Uuid,
) -> ApiResult<(Uuid, Vec<twilio::senders::Listed>)> {
    let key = key(state)?;
    let mut tx = state.pool.begin().await?;
    let row = live(&mut tx, workspace)
        .await?
        .ok_or(ApiError::invalid(NO_TWILIO))?;
    let token = credential::open(&mut tx, key, &row).await?;
    tx.commit().await?;
    let sid = twilio::shape::account_sid(&row.external_account_id).ok();
    let (Some(sid), Some(token)) = (sid, token) else {
        return Err(ApiError::invalid(RECONNECT));
    };
    match twilio::api::senders(&state.config.twilio, sid, &token).await {
        Ok(found) => Ok((row.id, twilio::senders::canonical(found))),
        Err(Failure::Refused) => {
            let mut tx = state.pool.begin().await?;
            workspaces::lock(&mut tx, workspace).await?;
            if store_write::set_reconnect_required(&mut tx, workspace, row.id).await? {
                store_write::event(&mut tx, workspace, row.id, "reconnect_required", actor).await?;
            }
            tx.commit().await?;
            Err(ApiError::invalid(RECONNECT))
        }
        // Senders not enabled or not listed: the account stays healthy (review L1).
        Err(Failure::Invalid) => Err(ApiError::invalid(NOT_LISTED)),
        Err(_) => Err(twilio::connect::unavailable()),
    }
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    access::ensure_reader(&state, &session, &workspace).await?;
    let (_, senders) = read(&state, &workspace, session.user.id).await?;
    let phones: Vec<String> = senders.iter().map(|sender| sender.phone.clone()).collect();
    let mut tx = state.pool.begin().await?;
    let taken = store::taken(&mut tx, &phones).await?;
    tx.commit().await?;
    let senders: Vec<Value> = senders
        .iter()
        .map(|sender| {
            let online = sender.status == twilio::senders::ONLINE;
            json!({
                "phone": sender.phone,
                "status": sender.status,
                "available": online && !taken.contains(&sender.phone),
            })
        })
        .collect();
    Ok(Json(json!({ "senders": senders })))
}
