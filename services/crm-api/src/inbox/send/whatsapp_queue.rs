//! The WhatsApp message itself (design §5): the consent, window and template rules, then
//! the queued message with its template and variables (kept only on the message, so Send
//! again can repeat it) and its outbox job, in the caller's transaction.
use super::{conflict, store, whatsapp::Content, whatsapp_rules as rules};
use crate::{
    error::{ApiError, ApiResult},
    inbox::consent,
    integrations::whatsapp,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'a, 'b> = &'a mut Transaction<'b, Postgres>;

/// The stored text and, for a template, its ID and values.
pub type Prepared = (String, Option<(String, Vec<String>)>);

/// The text to store and the template parts, after the consent, window and template rules.
pub async fn prepare(
    tx: Tx<'_, '_>,
    workspace: &str,
    connection: Uuid,
    key: &str,
    window: Option<i64>,
    content: Content,
) -> ApiResult<Prepared> {
    let current = consent::latest(tx, workspace, key).await?;
    let state = current.as_ref().map(|found| found.state.as_str());
    if state == Some("opt_out") {
        return Err(conflict("This client asked to stop messages.", "opted_out"));
    }
    match content {
        Content::Text(text) if window.is_some() => Ok((rules::text(&text)?, None)),
        Content::Text(_) => Err(conflict(
            "More than 24 hours have passed since the client's last message. Send an approved template.",
            "window_closed",
        )),
        Content::Template(..) if state != Some("opt_in") => Err(conflict(
            "Record the client's agreement before sending a template.",
            "agreement_required",
        )),
        Content::Template(sid, values) => {
            let found = whatsapp::template(tx, workspace, connection, &sid).await?;
            let found = found.ok_or(ApiError::invalid(rules::TEMPLATE))?;
            if found.variable_count as usize != values.len() {
                return Err(ApiError::invalid(rules::VARIABLES));
            }
            let body = whatsapp::fill(found.body.as_deref().unwrap_or(""), &values);
            Ok((body, Some((sid, values))))
        }
    }
}

/// Queues the message (with its template, if any) and its outbox job.
pub async fn queue(
    tx: Tx<'_, '_>,
    workspace: &str,
    conversation: Uuid,
    author: Uuid,
    prepared: Prepared,
    repeat_of: Option<Uuid>,
) -> ApiResult<Value> {
    let (body, template) = prepared;
    let mut message = store::queue(tx, workspace, conversation, author, &body, repeat_of).await?;
    if let Some((sid, values)) = template {
        sqlx::query(
            "UPDATE inbox.crm_inbox_messages SET template_sid=$2,template_variables=$3 \
             WHERE id=$1",
        )
        .bind(
            message["id"]
                .as_str()
                .and_then(|id| Uuid::parse_str(id).ok()),
        )
        .bind(&sid)
        .bind(&values)
        .execute(&mut **tx)
        .await?;
        message["template"] = json!(sid);
    }
    Ok(message)
}
