//! Sending one email through a member's own mailbox (E1b), for the Inbox's outbox domain.
//! Right before every send it re-checks that the mailbox is connected, that its owner is
//! the message's author, and that the author is still live with the email grant (security
//! review M1 and its notes). Results are fixed codes, never provider text.
use super::{
    credential,
    google::{gmail, mime, oauth, refresh},
    mailbox, store, store_write,
};
use crate::{
    config::{google_settings::GoogleConfig, messaging_settings::MessagingKey},
    error::ApiResult,
    workspaces,
};
use sqlx::PgPool;
use std::time::Duration;
use uuid::Uuid;

pub struct Outgoing<'a> {
    pub workspace: &'a str,
    pub connection: Uuid,
    pub author: Uuid,
    pub email: mime::Email<'a>,
    /// Gmail's thread ID once the conversation has one.
    pub thread: Option<&'a str>,
}

#[derive(Debug, PartialEq)]
pub enum Delivery {
    Sent {
        id: String,
        thread_id: String,
    },
    Retry {
        after: Option<Duration>,
        code: &'static str,
    },
    Failed {
        code: &'static str,
    },
    Unknown {
        code: &'static str,
    },
}

pub use mime::{plain_address, subject_ok, Email};

/// The member's connected Google mailbox, for the Inbox's reply and start rules.
pub async fn sending_mailbox(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    member: Uuid,
) -> ApiResult<Option<Uuid>> {
    Ok(store::own_mailbox(tx, workspace, member)
        .await?
        .filter(|row| row.state == "connected" && row.provider == "google")
        .map(|row| row.id))
}

pub async fn send(
    pool: &PgPool,
    key: &MessagingKey,
    google: &GoogleConfig,
    out: &Outgoing<'_>,
) -> ApiResult<Delivery> {
    let unavailable = Delivery::Failed {
        code: "sender_unavailable",
    };
    let mut tx = pool.begin().await?;
    let Some(row) = store::load(&mut tx, out.workspace, out.connection).await? else {
        return Ok(unavailable);
    };
    let author = workspaces::member(&mut tx, out.workspace, out.author).await;
    let allowed = author.is_ok_and(|user| mailbox::may_connect(&user, out.workspace));
    if !allowed || row.owner_member_id != Some(out.author) || row.provider != "google" {
        return Ok(unavailable);
    }
    if row.state != "connected" {
        return Ok(Delivery::Failed {
            code: "mailbox_reconnect",
        });
    }
    let token = credential::open(&mut tx, key, &row).await?;
    tx.commit().await?;
    let Some(token) = token else {
        return Ok(Delivery::Failed {
            code: "mailbox_reconnect",
        });
    };
    let access = match refresh::refresh(google, &token).await {
        Ok(access) => access,
        Err(oauth::Failure::Refused) => return reconnect(pool, out).await,
        Err(oauth::Failure::Unavailable | oauth::Failure::Invalid) => {
            return Ok(Delivery::Retry {
                after: None,
                code: "google_unavailable",
            })
        }
    };
    let Some(raw) = mime::raw(&out.email) else {
        return Ok(Delivery::Failed {
            code: "invalid_message",
        });
    };
    Ok(match gmail::send(google, &access, &raw, out.thread).await {
        gmail::Sent::Accepted { id, thread_id } => Delivery::Sent { id, thread_id },
        gmail::Sent::Retry { after } => Delivery::Retry {
            after,
            code: "rate_limited",
        },
        gmail::Sent::Unauthorised => return reconnect(pool, out).await,
        gmail::Sent::Refused => Delivery::Failed {
            code: "provider_refused",
        },
        gmail::Sent::Unknown => Delivery::Unknown {
            code: "provider_unclear",
        },
    })
}

/// Google no longer honours the token: mark the mailbox for its owner to sign in again.
async fn reconnect(pool: &PgPool, out: &Outgoing<'_>) -> ApiResult<Delivery> {
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
    Ok(Delivery::Failed {
        code: "mailbox_reconnect",
    })
}
