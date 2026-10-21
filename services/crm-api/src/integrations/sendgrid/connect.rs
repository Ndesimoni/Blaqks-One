//! Connecting a company's SendGrid account (SEC-1, docs/sendgrid-design.md §4): the key
//! must be restricted to the allowlist, and the account must list the company's domain as
//! authenticated. The domain becomes the connection's account ID, so the unique index
//! keeps one domain to one company. A company uses one email system at a time (E3c).
use super::{account, api};
use crate::{
    config::sendgrid_settings::SendgridConfig,
    error::{ApiError, ApiResult},
    integrations::{google::oauth::Failure, provider::ConnectedAccount, store},
    state::AppState,
};
use axum::http::StatusCode;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

const REFUSED: &str = "SendGrid did not accept this key. Check it and try again.";
const UNAVAILABLE: &str = "SendGrid could not be reached. Try again in a moment.";
const OTHER_SYSTEM: &str =
    "This company already uses another email system. Disconnect it before connecting this one.";
const USES_SENDGRID: &str =
    "Your company sends email through its SendGrid account, so personal mailboxes are not connected.";

fn failure(failure: Failure) -> ApiError {
    match failure {
        Failure::Refused => ApiError::invalid(REFUSED),
        Failure::Unavailable | Failure::Invalid => ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            UNAVAILABLE,
            "provider_unavailable",
        ),
    }
}

/// Proves the key and the domain before anything is stored.
pub async fn prove(config: &SendgridConfig, domain: &str, key: &str) -> ApiResult<String> {
    let domain = account::domain(domain).map_err(ApiError::invalid)?;
    let scopes = api::scopes(config, key).await.map_err(failure)?;
    account::scopes_ok(&scopes).map_err(ApiError::invalid)?;
    let listed = api::domains(config, key).await.map_err(failure)?;
    if !account::proves(&listed, &domain) {
        return Err(ApiError::invalid(account::NOT_AUTHENTICATED));
    }
    Ok(domain)
}

pub async fn account(
    config: &SendgridConfig,
    label: &str,
    domain: &str,
    key: &str,
) -> ApiResult<ConnectedAccount> {
    Ok(ConnectedAccount {
        label: label.to_owned(),
        external_account_id: prove(config, domain, key).await?,
    })
}

/// Reconnect: a new key must still open the connection's own domain. `None` for other
/// providers, and for a row that is missing here (the locked re-read then refuses it).
pub async fn reconnect_proof(
    state: &AppState,
    workspace: &str,
    id: Uuid,
    key: &str,
) -> ApiResult<Option<String>> {
    let mut tx = state.pool.begin().await?;
    let row = store::load(&mut tx, workspace, id).await?;
    tx.commit().await?;
    match row.filter(|row| row.provider == "sendgrid") {
        Some(row) => Ok(Some(
            prove(&state.config.sendgrid, &row.external_account_id, key).await?,
        )),
        None => Ok(None),
    }
}

/// Refuses a second email system in the company, under the caller's workspace lock.
pub async fn ensure_one_system(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    provider: &str,
) -> ApiResult<()> {
    let other: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM integrations.crm_channel_connections
         WHERE workspace_id=$1 AND channel='email' AND state<>'disconnected'
           AND (provider='sendgrid') <> ($2='sendgrid'))",
    )
    .bind(workspace)
    .bind(provider)
    .fetch_one(&mut **tx)
    .await?;
    match (other, provider) {
        (false, _) => Ok(()),
        (true, "sendgrid") => Err(ApiError::conflict(OTHER_SYSTEM)),
        (true, _) => Err(ApiError::conflict(USES_SENDGRID)),
    }
}
