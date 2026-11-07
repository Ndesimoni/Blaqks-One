//! Sending one email for the Inbox's outbox domain: through a member's own Google mailbox
//! (E1b, `google/deliver.rs`) or the company's SendGrid account (E3b, `sendgrid/send.rs`).
//! Each adapter re-checks the connection and the author right before the call. Results
//! are fixed codes, never provider text.
use super::{google::mime, store, store_write};
use crate::{
    config::{
        google_settings::GoogleConfig, messaging_settings::MessagingKey,
        sendgrid_settings::SendgridConfig,
    },
    error::ApiResult,
};
use sqlx::PgPool;
use std::time::Duration;
use uuid::Uuid;

pub struct Outgoing<'a> {
    pub workspace: &'a str,
    pub connection: Uuid,
    pub author: Uuid,
    /// The Inbox message; SendGrid builds its Message-ID from it.
    pub message: Uuid,
    /// Its files, read by owner right before the send (F3a); SendGrid only.
    pub attachments: &'a [crate::media::contents::File],
    pub email: mime::Email<'a>,
    /// Gmail's thread ID once the conversation has one.
    pub thread: Option<&'a str>,
}

#[derive(Debug, PartialEq)]
pub enum Delivery {
    Sent {
        id: String,
        thread_id: String,
        /// The Message-ID the CRM set (SendGrid); Gmail sets its own.
        rfc_id: Option<String>,
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

pub use super::sendgrid::sender::company_sender;

/// The longest one provider call may take, however large the attachments (F3a review M1).
pub const SEND_TIMEOUT_MAX: Duration = Duration::from_secs(20);
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
    google: Option<&GoogleConfig>,
    sendgrid: &SendgridConfig,
    out: &Outgoing<'_>,
) -> ApiResult<Delivery> {
    let unavailable = Delivery::Failed {
        code: "sender_unavailable",
    };
    let mut tx = pool.begin().await?;
    let Some(row) = store::load(&mut tx, out.workspace, out.connection).await? else {
        return Ok(unavailable);
    };
    tx.commit().await?;
    match (row.provider.as_str(), google) {
        ("sendgrid", _) => super::sendgrid::send::send(pool, key, sendgrid, out, &row).await,
        ("google", Some(google)) => {
            super::google::deliver::send(pool, key, google, out, &row).await
        }
        _ => Ok(unavailable),
    }
}

/// The provider no longer honours the credential: mark the connection for reconnecting.
pub(super) async fn reconnect(pool: &PgPool, out: &Outgoing<'_>) -> ApiResult<Delivery> {
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

/// Whether this connection can send attachments: company email through SendGrid (F3a).
pub async fn takes_attachments(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    connection: Uuid,
) -> ApiResult<bool> {
    let provider = store::load(tx, workspace, connection).await?;
    Ok(provider.is_some_and(|row| row.provider == "sendgrid"))
}
