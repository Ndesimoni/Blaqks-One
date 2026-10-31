//! Sending one email through a member's own Google mailbox (E1b), for `mail::send`. Right
//! before the send it re-checks that the mailbox is connected, that its owner is the
//! message's author, and that the author is still live with the email grant (security
//! review M1 and its notes). Results are fixed codes, never provider text.
use super::{gmail, mime, oauth, refresh};
use crate::{
    config::{google_settings::GoogleConfig, messaging_settings::MessagingKey},
    error::ApiResult,
    integrations::{credential, mail, mailbox, model::ConnectionRow},
    workspaces,
};
use sqlx::PgPool;

pub async fn send(
    pool: &PgPool,
    key: &MessagingKey,
    google: &GoogleConfig,
    out: &mail::Outgoing<'_>,
    row: &ConnectionRow,
) -> ApiResult<mail::Delivery> {
    // Gmail's message builder has no attachments yet (F3 design, review L3).
    if !out.attachments.is_empty() {
        return Ok(mail::Delivery::Failed {
            code: "attachments_unsupported",
        });
    }
    let mut tx = pool.begin().await?;
    let author = workspaces::member(&mut tx, out.workspace, out.author).await;
    let allowed = author.is_ok_and(|user| mailbox::may_connect(&user, out.workspace));
    if !allowed || row.owner_member_id != Some(out.author) || row.provider != "google" {
        return Ok(mail::Delivery::Failed {
            code: "sender_unavailable",
        });
    }
    if row.state != "connected" {
        return Ok(mail::Delivery::Failed {
            code: "mailbox_reconnect",
        });
    }
    let token = credential::open(&mut tx, key, row).await?;
    tx.commit().await?;
    let Some(token) = token else {
        return Ok(mail::Delivery::Failed {
            code: "mailbox_reconnect",
        });
    };
    let access = match refresh::refresh(google, &token).await {
        Ok(access) => access,
        Err(oauth::Failure::Refused) => return mail::reconnect(pool, out).await,
        Err(oauth::Failure::Unavailable | oauth::Failure::Invalid) => {
            return Ok(mail::Delivery::Retry {
                after: None,
                code: "google_unavailable",
            })
        }
    };
    let Some(raw) = mime::raw(&out.email) else {
        return Ok(mail::Delivery::Failed {
            code: "invalid_message",
        });
    };
    Ok(match gmail::send(google, &access, &raw, out.thread).await {
        gmail::Sent::Accepted { id, thread_id } => mail::Delivery::Sent {
            id,
            thread_id,
            rfc_id: None,
        },
        gmail::Sent::Retry { after } => mail::Delivery::Retry {
            after,
            code: "rate_limited",
        },
        gmail::Sent::Unauthorised => return mail::reconnect(pool, out).await,
        gmail::Sent::Refused => mail::Delivery::Failed {
            code: "provider_refused",
        },
        gmail::Sent::Unknown => mail::Delivery::Unknown {
            code: "provider_unclear",
        },
    })
}
