//! Carried finding L3 of the W1a review (design §17): a number moved to another Twilio
//! account stays active here until someone notices. When a send fails because Twilio says
//! the number is not a WhatsApp sender of this account (21606, 63007), the worker reads the
//! account's sender list again; only if that list was read to its end and does not list the
//! number at all is the number disconnected, freeing it for the account that now holds it.
//! A failed or partial read changes nothing.
use super::{store, write};
use crate::{
    config::{messaging_settings::MessagingKey, twilio_settings::TwilioConfig},
    error::ApiResult,
    integrations::{credential, store as connections, twilio},
    workspaces,
};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn recheck(
    pool: &PgPool,
    key: &MessagingKey,
    config: &TwilioConfig,
    workspace: &str,
    number: Uuid,
    actor: Uuid,
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
    let ended = write::disconnect(&mut tx, workspace, &current, actor).await?;
    tx.commit().await?;
    Ok(ended.is_some())
}
