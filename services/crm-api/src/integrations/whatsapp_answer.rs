//! What Twilio's answer to one WhatsApp send means (design §5 and §11): accepted with its
//! ID, retried after a rate limit or a refused connection, failed with a fixed reason, the
//! company account marked for reconnecting after a 401, or `unknown` when Twilio may have
//! accepted it. A "number not set up" refusal also rechecks the number (W1a review L3).
use super::{
    numbers, store_write, twilio,
    whatsapp::{Outgoing, Sent},
};
use crate::{
    config::{messaging_settings::MessagingKey, twilio_settings::TwilioConfig},
    error::ApiResult,
};
use sqlx::PgPool;
use twilio::messages::Answer;
use uuid::Uuid;

pub async fn settle(
    pool: &PgPool,
    key: &MessagingKey,
    config: &TwilioConfig,
    out: &Outgoing<'_>,
    number: Uuid,
    answer: Answer,
) -> ApiResult<Sent> {
    Ok(match answer {
        Answer::Accepted(sid) => Sent::Accepted(sid),
        Answer::RateLimited(after) => Sent::Retry {
            after,
            code: "rate_limited",
        },
        Answer::Refused => return reconnect(pool, out).await,
        Answer::Rejected(code) => {
            let code = twilio::codes::reason(code);
            // The number may have moved to another Twilio account (W1a review L3).
            if code == twilio::codes::NOT_SET_UP {
                let (pool, key, config) = (pool.clone(), key.clone(), config.clone());
                let (workspace, number) = (out.workspace.to_owned(), number);
                let author = out.author;
                tokio::spawn(async move {
                    let checked =
                        numbers::recheck::recheck(&pool, &key, &config, &workspace, number, author);
                    if checked.await.is_err() {
                        eprintln!("CRM could not recheck one WhatsApp number.");
                    }
                });
            }
            Sent::Failed { code }
        }
        // A refused connection never reached Twilio; anything later might have.
        Answer::Unreachable => Sent::Retry {
            after: None,
            code: "provider_unavailable",
        },
        Answer::Unclear => Sent::Unknown {
            code: "provider_unclear",
        },
    })
}

/// Twilio no longer honours the company's token: the account needs reconnecting.
async fn reconnect(pool: &PgPool, out: &Outgoing<'_>) -> ApiResult<Sent> {
    let mut tx = pool.begin().await?;
    if store_write::set_reconnect_required(&mut tx, out.workspace, out.connection).await? {
        store_write::event(
            &mut tx,
            out.workspace,
            out.connection,
            "reconnect_required",
            out.author,
        )
        .await?;
    }
    tx.commit().await?;
    Ok(Sent::Failed {
        code: "account_reconnect",
    })
}
