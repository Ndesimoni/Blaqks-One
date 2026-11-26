//! Carried finding L3 of the W1a review (design §17): a number moved to another Twilio
//! account stays active here until someone notices. When a send fails because Twilio says
//! the number is not a WhatsApp sender of this account (21606, 63007), the worker reads the
//! account's sender list again. Only a complete list, read to its end in Twilio's shape
//! with every sender readable, that does not list the number at all disconnects it (W1b
//! review L1); a failed, partial or odd read changes nothing. One recheck per number runs
//! at a time, and the change names no person: the CRM found it.
use super::{store, write};
use crate::{
    config::{messaging_settings::MessagingKey, twilio_settings::TwilioConfig},
    error::ApiResult,
    integrations::{credential, store as connections, twilio},
    workspaces,
};
use sqlx::PgPool;
use std::{
    collections::HashSet,
    sync::{Mutex, OnceLock},
};
use uuid::Uuid;

fn running() -> &'static Mutex<HashSet<Uuid>> {
    static RUNNING: OnceLock<Mutex<HashSet<Uuid>>> = OnceLock::new();
    RUNNING.get_or_init(|| Mutex::new(HashSet::new()))
}

/// Frees the number's slot when its recheck ends, however it ends.
struct Slot(Uuid);

impl Drop for Slot {
    fn drop(&mut self) {
        if let Ok(mut set) = running().lock() {
            set.remove(&self.0);
        }
    }
}

/// Starts a recheck of `number` unless one is already running in this process.
pub fn spawn(
    pool: PgPool,
    key: MessagingKey,
    config: TwilioConfig,
    workspace: String,
    number: Uuid,
) {
    let fresh = running().lock().is_ok_and(|mut set| set.insert(number));
    if !fresh {
        return;
    }
    let slot = Slot(number);
    tokio::spawn(async move {
        let _slot = slot;
        if recheck(&pool, &key, &config, &workspace, number)
            .await
            .is_err()
        {
            eprintln!("CRM could not recheck one WhatsApp number.");
        }
    });
}

pub async fn recheck(
    pool: &PgPool,
    key: &MessagingKey,
    config: &TwilioConfig,
    workspace: &str,
    number: Uuid,
) -> ApiResult<bool> {
    let mut tx = pool.begin().await?;
    let found = super::super::whatsapp::number(&mut tx, workspace, number).await?;
    let Some(found) = found.filter(|row| row.active) else {
        return Ok(false);
    };
    let row = connections::load(&mut tx, workspace, found.connection_id).await?;
    let Some(row) = row.filter(|row| row.provider == "twilio" && row.state == "connected") else {
        return Ok(false);
    };
    let token = credential::open(&mut tx, key, &row).await?;
    tx.commit().await?;
    let account = twilio::shape::account_sid(&row.external_account_id).ok();
    let (Some(account), Some(token)) = (account, token) else {
        return Ok(false);
    };
    let Ok((listed, true)) = twilio::api::senders(config, account, &token).await else {
        return Ok(false);
    };
    let listed = twilio::senders::canonical(listed);
    if listed.iter().any(|sender| sender.phone == found.phone) {
        return Ok(false);
    }
    let mut tx = pool.begin().await?;
    workspaces::lock(&mut tx, workspace).await?;
    let current = store::by_id(&mut tx, workspace, number).await?;
    let Some(current) = current.filter(|row| row.state == "active") else {
        return Ok(false);
    };
    let ended = write::disconnect(&mut tx, workspace, &current, None).await?;
    tx.commit().await?;
    Ok(ended.is_some())
}
