//! What a listing shows outside the company (docs/record-sharing.md R2): the outside
//! allowlist (the hand-over list without the exact location), the exact location kept
//! apart for the sender's switch, and the stored photos and floor plans. Never the property
//! ID, the owner contact, notes, viewing instructions, the documents link, permits,
//! authorisation, checks or the holder. Agreements calls this; it never reads `crm_records`.
use super::{handover_listing::Listing, listing_fields::FIELDS, shares::rules};
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use serde_json::{Map, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// The exact location, by stored name: sent only when the sender switches it on.
pub const LOCATION: [&str; 3] = ["unit_reference", "address", "map_link"];
/// Listing statuses that end outside shares and cannot be shared (migration 0070).
pub const CLOSED: [&str; 3] = ["Sold", "Rented", "Withdrawn"];
pub const UNAVAILABLE: &str = "This listing is no longer available.";
/// At most this many photos and floor plans go into one snapshot.
pub const MAX_PHOTOS: usize = 40;
pub const MAX_PLANS: usize = 10;

/// One stored photo or floor plan of the listing.
#[derive(Clone, Debug, PartialEq)]
pub struct Asset {
    pub file: Uuid,
    pub thumb: Option<Uuid>,
}

/// A listing as it may leave the company.
#[derive(Debug, Default)]
pub struct Outside {
    /// Allowlisted facts by their review name, present values only, without the location.
    pub facts: Map<String, Value>,
    /// The exact location by review name, present values only.
    pub location: Map<String, Value>,
    pub photos: Vec<Asset>,
    pub plans: Vec<Asset>,
    /// Older photos and plans stored inside the record, which cannot be shared.
    pub inline: usize,
    /// Photos and plans beyond the snapshot's limits.
    pub over: usize,
}

/// The review name of a stored field.
pub fn shown(stored: &str) -> Option<&'static str> {
    FIELDS
        .iter()
        .find(|(name, _)| *name == stored)
        .map(|(_, shown)| *shown)
}

fn assets(listing: &Listing, field: &str, max: usize) -> (Vec<Asset>, usize, usize) {
    let stored = listing.media(field);
    let all = listing.payload.get(field).and_then(Value::as_array);
    let inline = all.map_or(0, Vec::len).saturating_sub(stored.len());
    let over = stored.len().saturating_sub(max);
    let kept = stored.into_iter().take(max);
    let kept = kept.map(|(_, file, thumb)| Asset { file, thumb });
    (kept.collect(), inline, over)
}

/// The outside view of a stored property payload.
pub fn read(payload: &Value) -> Outside {
    let mut outside = Outside::default();
    for (stored, shown) in FIELDS {
        let value = payload.get(stored).and_then(Value::as_str).map(str::trim);
        let Some(value) = value.filter(|value| !value.is_empty()) else {
            continue;
        };
        let target = match LOCATION.contains(&stored) {
            true => &mut outside.location,
            false => &mut outside.facts,
        };
        target.insert(shown.to_owned(), Value::String(value.to_owned()));
    }
    let listing = Listing {
        record: Uuid::nil(),
        holder: None,
        payload: payload.clone(),
    };
    let (photos, inline, over) = assets(&listing, "media_photos", MAX_PHOTOS);
    let (plans, inline_plans, over_plans) = assets(&listing, "media_floorplans", MAX_PLANS);
    outside.photos = photos;
    outside.plans = plans;
    outside.inline = inline + inline_plans;
    outside.over = over + over_plans;
    outside
}

/// The listing `record` that `live` may share outside, locked `FOR SHARE`: its holder or
/// the company Admin with the Properties grant (403 when they only see it, the usual 404
/// otherwise, as in R1). A Sold, Rented or Withdrawn listing is refused.
pub async fn shareable(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    live: &UserRow,
    record: Uuid,
) -> ApiResult<Outside> {
    rules::shareable(tx, workspace, live, ("Properties", record)).await?;
    let payload: Value = sqlx::query_scalar(
        "SELECT payload FROM crm_records WHERE id=$1 AND workspace_id=$2 \
         AND collection='Properties'",
    )
    .bind(record)
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(ApiError::missing)?;
    let status = payload.get("listing_status").and_then(Value::as_str);
    if status.is_some_and(|status| CLOSED.contains(&status)) {
        return Err(ApiError::conflict(UNAVAILABLE));
    }
    Ok(read(&payload))
}

#[cfg(test)]
#[path = "outside_facts_tests.rs"]
mod tests;
