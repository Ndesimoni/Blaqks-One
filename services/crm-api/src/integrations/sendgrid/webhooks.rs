//! The connection's SendGrid webhooks (migration 0046): delivery events (E3b) and incoming
//! mail through Inbound Parse (E3c). They are set up after a connect or reconnect commits,
//! outside every lock, and only when `CRM_PUBLIC_URL` is configured. Each URL names the
//! connection, so a company's posts are verified with its own key (design §6).
use super::{parse_api, webhook_api};
use crate::{
    integrations::{credential, model::ConnectionRow, store},
    state::AppState,
};
use sqlx::Postgres;
use uuid::Uuid;

#[derive(Clone, Copy, PartialEq)]
pub enum Kind {
    Events,
    Inbound,
}

impl Kind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Events => "events",
            Self::Inbound => "inbound",
        }
    }
}

pub fn url(base: &str, connection: Uuid, kind: Kind) -> String {
    let path = kind.as_str();
    format!("{base}/api/integrations/webhooks/sendgrid/{connection}/{path}")
}

/// The stored public key of a live connection's webhook of `kind`, its workspace and the
/// connection's domain.
pub async fn key<'c, E: sqlx::Executor<'c, Database = Postgres>>(
    executor: E,
    connection: Uuid,
    kind: Kind,
) -> crate::error::ApiResult<Option<(String, String, String)>> {
    sqlx::query_as(
        "SELECT w.workspace_id,w.public_key,c.external_account_id
         FROM integrations.crm_sendgrid_webhooks w
         JOIN integrations.crm_channel_connections c ON c.id=w.connection_id
         WHERE w.connection_id=$1 AND w.kind=$2 AND c.provider='sendgrid'
           AND c.state<>'disconnected' AND c.workspace_id=w.workspace_id",
    )
    .bind(connection)
    .bind(kind.as_str())
    .fetch_optional(executor)
    .await
    .map_err(Into::into)
}

/// What is set up after this call: delivery updates and incoming mail. Every failure
/// answers `false` for that part; the Admin can reconnect to try again.
pub async fn ensure(state: &AppState, workspace: &str, connection: Uuid) -> (bool, bool) {
    let (Some(secret), Some(base)) = (
        state.config.messaging.as_ref(),
        state.config.sendgrid.webhook_base.as_deref(),
    ) else {
        return (false, false);
    };
    let Ok(mut tx) = state.pool.begin().await else {
        return (false, false);
    };
    let row = store::load(&mut tx, workspace, connection)
        .await
        .ok()
        .flatten();
    let Some(row) = row.filter(|row| row.provider == "sendgrid" && row.state == "connected") else {
        return (false, false);
    };
    let Some(api_key) = credential::open(&mut tx, secret, &row).await.ok().flatten() else {
        return (false, false);
    };
    drop(tx);
    let events = ensure_kind(state, base, &row, &api_key, Kind::Events).await;
    let inbound = ensure_kind(state, base, &row, &api_key, Kind::Inbound).await;
    (events, inbound)
}

async fn ready(state: &AppState, connection: Uuid, kind: Kind) -> bool {
    key(&state.pool, connection, kind)
        .await
        .ok()
        .flatten()
        .is_some()
}

async fn ensure_kind(
    state: &AppState,
    base: &str,
    row: &ConnectionRow,
    api_key: &str,
    kind: Kind,
) -> bool {
    if ready(state, row.id, kind).await {
        return true;
    }
    let config = &state.config.sendgrid;
    let target = url(base, row.id, kind);
    let domain = row.external_account_id.as_str();
    let created = match kind {
        Kind::Events => webhook_api::create(config, api_key, &target).await,
        Kind::Inbound => parse_api::create(config, api_key, domain, &target)
            .await
            .map(|public_key| (domain.to_owned(), public_key)),
    };
    let Ok((id, public_key)) = created else {
        return false;
    };
    let stored = sqlx::query(
        "INSERT INTO integrations.crm_sendgrid_webhooks
         (connection_id,kind,workspace_id,provider_webhook_id,public_key)
         SELECT id,$5,workspace_id,$2,$3 FROM integrations.crm_channel_connections
         WHERE id=$1 AND workspace_id=$4 AND state='connected'
         ON CONFLICT (connection_id,kind) DO NOTHING",
    )
    .bind(row.id)
    .bind(&id)
    .bind(&public_key)
    .bind(&row.workspace_id)
    .bind(kind.as_str())
    .execute(&state.pool)
    .await;
    let kept = matches!(stored, Ok(done) if done.rows_affected() == 1);
    // A lost race leaves only its own events webhook behind. A Parse setting is the
    // domain's only one, so it is removed only when no key was kept for it (review L2).
    let ready = ready(state, row.id, kind).await;
    match kind {
        Kind::Events if !kept => webhook_api::delete(config, api_key, &id).await,
        Kind::Inbound if !ready => parse_api::delete(config, api_key, domain).await,
        _ => {}
    }
    ready
}

#[path = "webhooks_removal.rs"]
mod removal;

pub use removal::{pending_removal, remove};
