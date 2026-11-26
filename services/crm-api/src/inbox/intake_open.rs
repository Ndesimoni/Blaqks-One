//! Opening the conversation for a new thread (design §4 and §6): the sender is matched
//! against Clients and Contacts through the records module, run through the lead rules and
//! routed: listing agent, then the matched record's holder, else Unassigned.
use super::{events, intake_store as store, matching, normalize::Contact, rules::Decision};
use crate::{error::ApiResult, integrations::webhooks::inbound::Event};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Opens the conversation for a new thread and returns its ID.
pub async fn open(
    tx: &mut Transaction<'_, Postgres>,
    event: &Event,
    contact: &Contact,
) -> ApiResult<Uuid> {
    let workspace = event.workspace_id.as_str();
    let message = &event.message;
    let found = matching::resolve(tx, event, contact).await?;
    let (match_state, linked, decision) = (found.match_state, found.linked, found.decision);
    let id = Uuid::new_v4();
    let holder = linked.as_ref().and_then(|(_, _, assignee)| *assignee);
    let new = store::NewConversation {
        id,
        workspace,
        channel: &event.channel,
        connection: event.connection_id,
        thread: &message.thread_id,
        key: &contact.key,
        display: &contact.display,
        name: message.name.as_deref(),
        match_state,
        linked: linked
            .as_ref()
            .map(|(collection, record, _)| (collection.as_str(), *record)),
        // A mailbox's mail stays with its owner, never the record's holder (E1c H1).
        assignee: super::intake_company::live_owner(tx, event)
            .await?
            .or(found.listing_agent.or(holder)),
        state: if linked.is_some() { "open" } else { "new" },
        suggested: decision == Decision::Suggest,
        source: message.source.map(|source| source.as_str()),
        subject: message
            .email
            .as_ref()
            .and_then(|meta| meta.subject.as_deref()),
    };
    store::open(tx, &new).await?;
    events::append(tx, workspace, id, None, "created").await?;
    let follow_up = match (decision, linked.is_some()) {
        (Decision::Create, _) => Some("lead_created"),
        (Decision::Suggest, _) => Some("lead_suggested"),
        (_, true) => Some("matched"),
        _ => None,
    };
    if let Some(action) = follow_up {
        events::append(tx, workspace, id, None, action).await?;
    }
    Ok(id)
}
