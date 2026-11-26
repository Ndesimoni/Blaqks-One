//! Removing a connection's SendGrid webhooks once its disconnect has committed (E3b
//! review M2): the IDs and the key are read inside the disconnect transaction, after its
//! checks; SendGrid is called after the commit, outside every lock, best effort.
use super::{super::parse_api, super::webhook_api, Kind};
use crate::{
    config::{messaging_settings::MessagingKey, sendgrid_settings::SendgridConfig},
    error::ApiResult,
    integrations::{credential, model::ConnectionRow},
};
use sqlx::{Postgres, Transaction};

pub struct Removal {
    api_key: String,
    webhooks: Vec<(Kind, String)>,
}

pub async fn pending_removal(
    tx: &mut Transaction<'_, Postgres>,
    key: Option<&MessagingKey>,
    row: &ConnectionRow,
) -> ApiResult<Option<Removal>> {
    let Some(key) = key.filter(|_| row.provider == "sendgrid") else {
        return Ok(None);
    };
    let found: Vec<(String, String)> = sqlx::query_as(
        "SELECT kind,provider_webhook_id FROM integrations.crm_sendgrid_webhooks
         WHERE connection_id=$1 AND workspace_id=$2",
    )
    .bind(row.id)
    .bind(&row.workspace_id)
    .fetch_all(&mut **tx)
    .await?;
    let webhooks: Vec<(Kind, String)> = found
        .into_iter()
        .map(|(kind, id)| match kind.as_str() {
            "inbound" => (Kind::Inbound, id),
            _ => (Kind::Events, id),
        })
        .collect();
    let api_key = credential::open(tx, key, row).await?;
    Ok(api_key
        .filter(|_| !webhooks.is_empty())
        .map(|api_key| Removal { api_key, webhooks }))
}

/// Their posts are refused anyway once the keys are forgotten.
pub async fn remove(config: &SendgridConfig, removal: Removal) {
    for (kind, id) in &removal.webhooks {
        match kind {
            Kind::Events => webhook_api::delete(config, &removal.api_key, id).await,
            Kind::Inbound => parse_api::delete(config, &removal.api_key, id).await,
        }
    }
}
