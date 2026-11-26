//! Reading a company's templates from Twilio (design §8): on connect, when the Admin presses
//! Refresh, and once a day in the messaging worker. Twilio is called outside any
//! transaction; the result is written under a lock on the connection row, and only while
//! the connection is still connected. A refused token marks the account for reconnecting;
//! a temporary failure keeps the templates as they were.
use super::store;
use crate::{
    config::{messaging_settings::MessagingKey, twilio_settings::TwilioConfig},
    error::ApiResult,
    integrations::{credential, google::oauth::Failure, store as connections, store_write, twilio},
};
use sqlx::PgPool;
use std::time::Duration;
use uuid::Uuid;

/// Reads and stores the connection's templates; `actor` is the Admin who asked, or `None`
/// for the worker's daily read.
pub async fn sync(
    pool: &PgPool,
    key: &MessagingKey,
    config: &TwilioConfig,
    workspace: &str,
    connection: Uuid,
    actor: Option<Uuid>,
) -> ApiResult<Result<(), Failure>> {
    let mut tx = pool.begin().await?;
    let row = connections::load(&mut tx, workspace, connection).await?;
    let Some(row) = row.filter(|row| row.provider == "twilio" && row.state == "connected") else {
        return Ok(Err(Failure::Refused));
    };
    let token = credential::open(&mut tx, key, &row).await?;
    tx.commit().await?;
    let sid = twilio::shape::account_sid(&row.external_account_id).ok();
    let (Some(sid), Some(token)) = (sid, token) else {
        return Ok(Err(Failure::Refused));
    };
    let listed = twilio::content::list(config, sid, &token).await;
    let mut tx = pool.begin().await?;
    let live: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM integrations.crm_channel_connections \
         WHERE id=$1 AND workspace_id=$2 AND state='connected' FOR UPDATE",
    )
    .bind(connection)
    .bind(workspace)
    .fetch_optional(&mut *tx)
    .await?;
    if live.is_none() {
        return Ok(Err(Failure::Refused));
    }
    let result = match listed {
        Ok((contents, complete)) => {
            let parsed: Vec<_> = contents
                .iter()
                .filter_map(twilio::templates::parse)
                .collect();
            store::replace(&mut tx, workspace, connection, &parsed, complete).await?;
            Ok(())
        }
        Err(Failure::Refused) => {
            if store_write::set_reconnect_required(&mut tx, workspace, connection).await? {
                store_write::event_by(&mut tx, workspace, connection, "reconnect_required", actor)
                    .await?;
            }
            Err(Failure::Refused)
        }
        Err(failure) => Err(failure),
    };
    sqlx::query(
        "UPDATE integrations.crm_channel_connections SET templates_checked_at=now(), \
           templates_synced_at=CASE WHEN $3 THEN now() ELSE templates_synced_at END \
         WHERE id=$1 AND workspace_id=$2",
    )
    .bind(connection)
    .bind(workspace)
    .bind(result.is_ok())
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(result)
}

/// The worker's daily read: each connected Twilio account not checked for a day.
pub async fn round(pool: &PgPool, key: &MessagingKey, config: &TwilioConfig) -> ApiResult<()> {
    let due: Vec<(String, Uuid)> = sqlx::query_as(
        "SELECT workspace_id,id FROM integrations.crm_channel_connections \
         WHERE provider='twilio' AND state='connected' AND (templates_checked_at IS NULL \
           OR templates_checked_at<now()-interval '1 day') \
         ORDER BY templates_checked_at NULLS FIRST LIMIT 20",
    )
    .fetch_all(pool)
    .await?;
    for (workspace, id) in due {
        if sync(pool, key, config, &workspace, id, None).await.is_err() {
            eprintln!("CRM template sync failed for one Twilio account.");
        }
    }
    Ok(())
}

/// The worker loop: a round every `every` until shutdown.
pub fn spawn(
    pool: PgPool,
    key: MessagingKey,
    config: TwilioConfig,
    every: Duration,
    mut shutdown: tokio::sync::watch::Receiver<bool>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            if round(&pool, &key, &config).await.is_err() {
                eprintln!("CRM template sync round failed.");
            }
            if crate::outbox::worker::pause(&mut shutdown, every).await {
                break;
            }
        }
    })
}
