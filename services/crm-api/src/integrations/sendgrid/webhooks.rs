//! The connection's delivery-event webhook (E3b, migration 0046). It is set up after a
//! connect or reconnect commits, outside every lock, and only when `CRM_PUBLIC_URL` is
//! configured; without it sent mail simply stays `sent`. The URL names the connection, so
//! each company's events are verified with its own key (design §6).
use super::webhook_api;
use crate::{
    config::{messaging_settings::MessagingKey, sendgrid_settings::SendgridConfig},
    error::ApiResult,
    integrations::{credential, model::ConnectionRow, store},
    state::AppState,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub fn events_url(base: &str, connection: Uuid) -> String {
    format!("{base}/api/integrations/webhooks/sendgrid/{connection}/events")
}

/// The stored public key of a live connection's events webhook, and its workspace.
pub async fn events_key<'c, E: sqlx::Executor<'c, Database = Postgres>>(
    executor: E,
    connection: Uuid,
) -> ApiResult<Option<(String, String)>> {
    sqlx::query_as(
        "SELECT w.workspace_id,w.public_key FROM integrations.crm_sendgrid_webhooks w
         JOIN integrations.crm_channel_connections c ON c.id=w.connection_id
         WHERE w.connection_id=$1 AND w.kind='events' AND c.provider='sendgrid'
           AND c.state<>'disconnected' AND c.workspace_id=w.workspace_id",
    )
    .bind(connection)
    .fetch_optional(executor)
    .await
    .map_err(Into::into)
}

/// Whether delivery updates are set up for the connection, creating the webhook if not.
/// Every failure answers `false`; the Admin can reconnect to try again.
pub async fn ensure(state: &AppState, workspace: &str, connection: Uuid) -> bool {
    let (Some(key), Some(base)) = (
        state.config.messaging.as_ref(),
        state.config.sendgrid.webhook_base.as_deref(),
    ) else {
        return false;
    };
    let Ok(mut tx) = state.pool.begin().await else {
        return false;
    };
    let row: Option<ConnectionRow> = store::load(&mut tx, workspace, connection)
        .await
        .ok()
        .flatten();
    let Some(row) = row.filter(|row| row.provider == "sendgrid" && row.state == "connected") else {
        return false;
    };
    if events_key(&mut *tx, connection)
        .await
        .ok()
        .flatten()
        .is_some()
    {
        return true;
    }
    let Some(api_key) = credential::open(&mut tx, key, &row).await.ok().flatten() else {
        return false;
    };
    drop(tx);
    let url = events_url(base, connection);
    let config = &state.config.sendgrid;
    let Ok((id, public_key)) = webhook_api::create(config, &api_key, &url).await else {
        return false;
    };
    let stored = sqlx::query(
        "INSERT INTO integrations.crm_sendgrid_webhooks
         (connection_id,kind,workspace_id,provider_webhook_id,public_key)
         SELECT id,'events',workspace_id,$2,$3 FROM integrations.crm_channel_connections
         WHERE id=$1 AND workspace_id=$4 AND state='connected'
         ON CONFLICT (connection_id,kind) DO NOTHING",
    )
    .bind(connection)
    .bind(&id)
    .bind(&public_key)
    .bind(workspace)
    .execute(&state.pool)
    .await;
    if !matches!(stored, Ok(done) if done.rows_affected() == 1) {
        webhook_api::delete(config, &api_key, &id).await;
    }
    events_ready(state, connection).await
}

async fn events_ready(state: &AppState, connection: Uuid) -> bool {
    events_key(&state.pool, connection)
        .await
        .ok()
        .flatten()
        .is_some()
}

/// A webhook to remove at SendGrid once a disconnect has committed (review M2).
pub struct Removal {
    api_key: String,
    id: String,
}

/// Read inside the disconnect transaction, after its checks and before the key is cleared.
pub async fn pending_removal(
    tx: &mut Transaction<'_, Postgres>,
    key: Option<&MessagingKey>,
    row: &ConnectionRow,
) -> ApiResult<Option<Removal>> {
    let Some(key) = key.filter(|_| row.provider == "sendgrid") else {
        return Ok(None);
    };
    let id: Option<String> = sqlx::query_scalar(
        "SELECT provider_webhook_id FROM integrations.crm_sendgrid_webhooks
         WHERE connection_id=$1 AND workspace_id=$2 AND kind='events'",
    )
    .bind(row.id)
    .bind(&row.workspace_id)
    .fetch_optional(&mut **tx)
    .await?;
    let api_key = credential::open(tx, key, row).await?;
    Ok(id.zip(api_key).map(|(id, api_key)| Removal { api_key, id }))
}

/// After the commit and outside every lock: best effort, since its events are refused.
pub async fn remove(config: &SendgridConfig, removal: Removal) {
    webhook_api::delete(config, &removal.api_key, &removal.id).await;
}
