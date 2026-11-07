//! What the Inbox may ask `integrations` about WhatsApp (packet W1b, design §5 and §18): a
//! member's own number, a number row by ID, whether the company account is connected, its
//! offered templates, and the send itself (`whatsapp_send.rs`). Other modules never read
//! the numbers, templates or connections tables (service boundaries).
use super::templates::store;
use crate::error::ApiResult;
use sqlx::{FromRow, Postgres, Transaction};
use std::time::Duration;
use uuid::Uuid;

pub use super::templates::store::Template;
pub use super::twilio::templates::fill;
pub use super::whatsapp_send::send;

type Tx<'a, 'b> = &'a mut Transaction<'b, Postgres>;

pub enum Content<'a> {
    Text(&'a str),
    Template {
        sid: &'a str,
        variables: &'a [String],
    },
}

pub struct Outgoing<'a> {
    pub workspace: &'a str,
    pub connection: Uuid,
    pub number: Uuid,
    pub author: Uuid,
    /// The Inbox message; its status callback URL names it.
    pub message: Uuid,
    pub to: &'a str,
    pub content: Content<'a>,
}

#[derive(Debug, PartialEq)]
pub enum Sent {
    /// Twilio accepted it, with its `SM…` ID when the answer could be read.
    Accepted(Option<String>),
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

#[derive(Clone, Debug, FromRow)]
pub struct Number {
    pub id: Uuid,
    pub member_id: Uuid,
    pub phone: String,
    pub connection_id: Uuid,
    pub active: bool,
    /// The company Twilio account is `connected` (not disconnected or to reconnect).
    pub account_connected: bool,
}

const SELECT: &str = "SELECT n.id,n.member_id,n.phone_e164 AS phone,n.connection_id, \
    n.state='active' AS active, COALESCE(c.state='connected',false) AS account_connected \
    FROM integrations.crm_whatsapp_numbers n \
    LEFT JOIN integrations.crm_channel_connections c \
      ON c.id=n.connection_id AND c.workspace_id=n.workspace_id";

/// The member's active number in this company, if the Admin gave them one.
pub async fn own_number(
    tx: Tx<'_, '_>,
    workspace: &str,
    member: Uuid,
) -> ApiResult<Option<Number>> {
    sqlx::query_as(&format!(
        "{SELECT} WHERE n.workspace_id=$1 AND n.member_id=$2 AND n.state='active'"
    ))
    .bind(workspace)
    .bind(member)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

/// A number row of this company, active or not (a thread keeps its number's history).
pub async fn number(tx: Tx<'_, '_>, workspace: &str, id: Uuid) -> ApiResult<Option<Number>> {
    sqlx::query_as(&format!("{SELECT} WHERE n.workspace_id=$1 AND n.id=$2"))
        .bind(workspace)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(Into::into)
}

/// The templates the composer may offer on this connection.
pub async fn templates(
    tx: Tx<'_, '_>,
    workspace: &str,
    connection: Uuid,
) -> ApiResult<Vec<Template>> {
    store::offered(tx, workspace, connection).await
}

/// One offered template, or `None` when it is unknown, not approved or not text.
pub async fn template(
    tx: Tx<'_, '_>,
    workspace: &str,
    connection: Uuid,
    sid: &str,
) -> ApiResult<Option<Template>> {
    store::offered_one(tx, workspace, connection, sid).await
}
