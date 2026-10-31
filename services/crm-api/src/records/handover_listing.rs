//! The listing a hand-over review shows before acceptance (agreements design §18, owner
//! 2026-10-22: all listing details except the owner's name and phone). An allowlist of
//! property fields plus the stored photos and floor plans; never the owner contact, notes,
//! viewing instructions, the documents link, permits, authorisation, checks or record IDs.
use super::{
    listing_fields::BASIC,
    media_links::{self, KIND},
};
use crate::{error::ApiResult, media::serve, state::AppState};
use axum::response::Response;
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub use super::listing_fields::{shared, FIELDS};

/// The property's stored row: its ID and holder (kept on the server) and payload.
pub struct Listing {
    pub record: Uuid,
    pub holder: Option<Uuid>,
    pub payload: Value,
}

impl Listing {
    /// Each allowlisted field as stored text, if any; only the twelve basic facts unless
    /// `full` (the sender holds the listing, so it moves or is shared; review L3).
    pub fn facts(&self, full: bool) -> impl Iterator<Item = (&'static str, Option<&str>)> + '_ {
        FIELDS.iter().map(move |(stored, shown)| {
            let shown_here = full || BASIC.contains(stored);
            let value = self.payload.get(*stored).and_then(Value::as_str);
            (*shown, value.filter(|_| shown_here))
        })
    }

    /// Stored photos or floor plans as `(name, file, thumb)`; older inline images are left
    /// out.
    pub fn media(&self, field: &str) -> Vec<(String, Uuid, Option<Uuid>)> {
        let entries = self.payload.get(field).and_then(Value::as_array);
        let id = |entry: &Value, key: &str| {
            entry
                .get(key)
                .and_then(Value::as_str)
                .and_then(|text| Uuid::parse_str(text).ok())
        };
        entries
            .into_iter()
            .flatten()
            .filter_map(|entry| {
                let name = entry.get("name").and_then(Value::as_str).unwrap_or("");
                let name: String = name.chars().take(120).collect();
                id(entry, "file").map(|file| (name, file, id(entry, "thumb")))
            })
            .collect()
    }
}

/// The deal's property, read without a lock (none when the deal has no property).
pub async fn listing(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    property_ref: Option<&str>,
) -> ApiResult<Option<Listing>> {
    let Some(property_ref) = property_ref else {
        return Ok(None);
    };
    let found: Option<(Uuid, Option<Uuid>, Value)> = sqlx::query_as(
        "SELECT id,assignee_id,payload FROM crm_records WHERE workspace_id=$1 \
         AND collection='Properties' AND legacy_id=$2",
    )
    .bind(workspace)
    .bind(property_ref)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(found.map(|(record, holder, payload)| Listing {
        record,
        holder,
        payload,
    }))
}

/// One of the listing's own stored photos or floor plans, or not-found for any other file.
/// The caller has already checked that the asker may review the hand-over.
pub async fn file(
    state: &AppState,
    tx: &mut Transaction<'_, Postgres>,
    (workspace, listing): (&str, &Listing),
    file: Uuid,
) -> ApiResult<Option<Response>> {
    if !media_links::referenced(&listing.payload).contains(&file) {
        return Ok(None);
    }
    let response = serve::file(state, tx, workspace, KIND, listing.record, file).await?;
    Ok(Some(response))
}

#[cfg(test)]
#[path = "handover_listing_tests.rs"]
mod tests;
