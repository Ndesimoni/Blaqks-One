//! Deciding what a new thread is (design §6): an exact record match, the sender's earlier
//! linked conversation, or an unknown sender run through the lead rules. Automatic leads
//! are capped per sender and per connected account each day (SEC-8, X3-S1); beyond a cap
//! the message stays a suggestion for a person.
use super::{
    leads,
    normalize::Contact,
    rules::{self, Decision},
};
use crate::{
    error::ApiResult, integrations::webhooks::inbound::Event, records::lookup, workspaces,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const AUTO_LEADS_PER_SENDER: i64 = 1;
pub const AUTO_LEADS_PER_CONNECTION: i64 = 50;

pub struct Resolution {
    pub match_state: &'static str,
    /// `(collection, record, holder)`.
    pub linked: Option<(String, Uuid, Option<Uuid>)>,
    pub decision: Decision,
    pub listing_agent: Option<Uuid>,
}

type Tx<'a, 'b> = &'a mut Transaction<'b, Postgres>;

/// The record this sender's latest linked conversation on the channel points to.
async fn previous_link(
    tx: Tx<'_, '_>,
    workspace: &str,
    channel: &str,
    key: &str,
) -> ApiResult<Option<(String, Uuid)>> {
    sqlx::query_as(
        "SELECT linked_collection,linked_record_id FROM inbox.crm_inbox_conversations \
         WHERE workspace_id=$1 AND channel=$2 AND contact_key=$3 AND linked_record_id IS NOT NULL \
         ORDER BY last_activity_at DESC LIMIT 1",
    )
    .bind(workspace)
    .bind(channel)
    .bind(key)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

/// System-created leads in the last day: `(this connection, this sender)`.
async fn auto_leads(
    tx: Tx<'_, '_>,
    workspace: &str,
    event: &Event,
    key: &str,
) -> ApiResult<(i64, i64)> {
    sqlx::query_as(
        "SELECT count(*) FILTER (WHERE c.connection_id=$2), \
           count(*) FILTER (WHERE c.channel=$3 AND c.contact_key=$4) \
         FROM inbox.crm_inbox_events e JOIN inbox.crm_inbox_conversations c ON c.id=e.conversation_id \
         WHERE e.workspace_id=$1 AND e.action='lead_created' AND e.actor_id IS NULL \
           AND e.created_at>now()-interval '1 day'",
    )
    .bind(workspace)
    .bind(event.connection_id)
    .bind(&event.channel)
    .bind(key)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

pub async fn resolve(tx: Tx<'_, '_>, event: &Event, contact: &Contact) -> ApiResult<Resolution> {
    let workspace = event.workspace_id.as_str();
    let message = &event.message;
    let candidates = match (&contact.phone_digits, &contact.email) {
        (None, None) => Vec::new(),
        (phone, email) => {
            lookup::contact_matches(tx, workspace, phone.as_deref(), email.as_deref()).await?
        }
    };
    let listing_agent = match &message.listing {
        Some(listing) => lookup::property_holder(tx, workspace, listing).await?,
        None => None,
    };
    let mut resolution = Resolution {
        match_state: "unknown",
        linked: None,
        decision: Decision::Nothing,
        listing_agent,
    };
    match candidates.as_slice() {
        [] => {}
        [only] => {
            resolution.match_state = "linked";
            resolution.linked = Some((only.collection.clone(), only.record_id, only.assignee_id));
            return Ok(resolution);
        }
        _ => {
            resolution.match_state = "choice";
            return Ok(resolution);
        }
    }
    if let Some((collection, record)) =
        previous_link(tx, workspace, &event.channel, &contact.key).await?
    {
        resolution.match_state = "linked";
        resolution.linked = Some((collection, record, None));
        return Ok(resolution);
    }
    let rules = rules::load(tx, workspace).await?;
    resolution.decision = rules::decide(&rules, message.source, &message.text);
    if resolution.decision == Decision::Create {
        let (connection, sender) = auto_leads(tx, workspace, event, &contact.key).await?;
        if connection >= AUTO_LEADS_PER_CONNECTION || sender >= AUTO_LEADS_PER_SENDER {
            resolution.decision = Decision::Suggest;
            return Ok(resolution);
        }
        // The owner is the actor of record for automatic leads (X3-S5); the Inbox event
        // itself has no actor, which marks it as system-created.
        let owner = workspaces::owner_of(tx, workspace).await?;
        let name = message.name.as_deref();
        let lead = leads::create(tx, owner, workspace, &event.channel, contact, name).await?;
        resolution.match_state = "linked";
        resolution.linked = Some(("Clients".into(), lead.id, lead.assignee));
    }
    Ok(resolution)
}
