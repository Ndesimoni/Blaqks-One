use super::collections::{Links, Slot};
use crate::error::{ApiError, ApiResult};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Slots in the order they are reported, with the collection each must name.
const SLOTS: [(Slot, &str); 4] = [
    (Slot::Contact, "Contacts"),
    (Slot::Client, "Clients"),
    (Slot::Property, "Properties"),
    (Slot::Referral, "Clients"),
];

fn value(links: &Links, slot: Slot) -> Option<&str> {
    match slot {
        Slot::Contact => links.contact.as_deref(),
        Slot::Client => links.client.as_deref(),
        Slot::Property => links.property.as_deref(),
        Slot::Referral => links.referral.as_deref(),
    }
}

pub fn missing_message(slot: Slot) -> &'static str {
    match slot {
        Slot::Referral => {
            "The referred client is missing from this workspace. \
             Choose another client or clear the referral."
        }
        Slot::Client => "The linked client is missing from this workspace. Choose another client.",
        Slot::Property => {
            "The linked property is missing from this workspace. \
             Choose another property or clear it."
        }
        Slot::Contact => {
            "The linked contact is missing from this workspace. \
             Choose another contact or clear it."
        }
    }
}

/// Reports the first linked record missing from the workspace with a specific
/// message. Call under the workspace lock; the database foreign keys stay the
/// authoritative check. `saving` is the record being updated, which never
/// counts as its own target (its legacy ID may be changing in this request).
pub async fn ensure_present(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    links: &Links,
    saving: Option<Uuid>,
) -> ApiResult<()> {
    let wanted: Vec<(Slot, &str, &str)> = SLOTS
        .iter()
        .filter_map(|(slot, collection)| Some((*slot, *collection, value(links, *slot)?)))
        .collect();
    if wanted.is_empty() {
        return Ok(());
    }
    let collections: Vec<&str> = wanted
        .iter()
        .map(|(_, collection, _)| *collection)
        .collect();
    let ids: Vec<&str> = wanted.iter().map(|(_, _, id)| *id).collect();
    let present: Vec<bool> = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM crm_records AS target WHERE target.workspace_id=$1 \
         AND target.collection=wanted.collection AND target.legacy_id=wanted.legacy_id \
         AND target.id IS DISTINCT FROM $4) \
         FROM unnest($2::text[],$3::text[]) WITH ORDINALITY AS wanted(collection,legacy_id,position) \
         ORDER BY wanted.position",
    )
    .bind(workspace)
    .bind(&collections)
    .bind(&ids)
    .bind(saving)
    .fetch_all(&mut **transaction)
    .await?;
    match wanted.iter().zip(present).find(|(_, present)| !present) {
        Some(((slot, _, _), _)) => Err(ApiError::link_missing(missing_message(*slot))),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_slot_has_a_distinct_message_and_target() {
        let messages: std::collections::HashSet<_> = SLOTS
            .iter()
            .map(|(slot, _)| missing_message(*slot))
            .collect();
        assert_eq!(messages.len(), 4);
        let links = Links {
            referral: Some("CL-1".into()),
            ..Links::default()
        };
        assert_eq!(value(&links, Slot::Referral), Some("CL-1"));
        assert_eq!(value(&links, Slot::Client), None);
        let error = ApiError::link_missing(missing_message(Slot::Contact));
        assert_eq!((error.0.as_u16(), error.2), (409, "link_missing"));
    }
}
