//! Reconnect proofs over the network, made before the workspace lock (E3a, W1a): a new
//! SendGrid key must still open the connection's own domain, and a new Twilio Auth Token
//! must still open the connection's own Account SID (design §4.4). Each returns the
//! account it proved, which `commands::reconnect` compares with the locked row.
use super::{model::State, store};
use crate::{error::ApiResult, state::AppState};
use uuid::Uuid;

/// Providers whose reconnect is proved here rather than by the local stub.
pub fn proved(provider: &str) -> bool {
    matches!(provider, "sendgrid" | "twilio")
}

/// `None` for other providers, and for a row missing or disconnected here (the locked
/// re-read then refuses it as missing).
pub async fn reconnect(
    state: &AppState,
    workspace: &str,
    id: Uuid,
    credential: &str,
) -> ApiResult<Option<String>> {
    let mut tx = state.pool.begin().await?;
    let row = store::load(&mut tx, workspace, id)
        .await?
        .filter(|row| row.state() != State::Disconnected);
    tx.commit().await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let account = &row.external_account_id;
    match row.provider.as_str() {
        "sendgrid" => {
            let config = &state.config.sendgrid;
            super::sendgrid::connect::prove(config, account, credential)
                .await
                .map(Some)
        }
        "twilio" => {
            let config = &state.config.twilio;
            super::twilio::connect::prove(config, account, credential)
                .await
                .map(Some)
        }
        _ => Ok(None),
    }
}
