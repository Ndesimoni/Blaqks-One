//! The listing a hand-over review shows before acceptance (agreements design §18, owner
//! 2026-10-22: all listing details except the owner's name and phone). An allowlist of
//! property fields plus the stored photos and floor plans; never the owner contact, notes,
//! viewing instructions, the documents link, permits, authorisation, checks or record IDs.
use super::media_links::{self, KIND};
use crate::{error::ApiResult, media::serve, state::AppState};
use axum::response::Response;
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Stored field → the name the review uses.
pub const FIELDS: [(&str, &str); 29] = [
    ("listing_title", "listingTitle"),
    ("sale_rental", "saleRental"),
    ("emirate", "emirate"),
    ("community", "community"),
    ("building_project", "building"),
    ("unit_reference", "unitReference"),
    ("property_type", "propertyType"),
    ("bedrooms", "bedrooms"),
    ("bathrooms", "bathrooms"),
    ("area_sq_ft", "sizeSqft"),
    ("price_annual_rent_aed", "priceAed"),
    ("price_basis", "priceBasis"),
    ("listing_status", "listingStatus"),
    ("ready_off_plan", "readyOffPlan"),
    ("furnishing", "furnishing"),
    ("available_from", "availableFrom"),
    ("rental_cheques", "rentalCheques"),
    ("deposit_aed", "depositAed"),
    ("minimum_stay_nights", "minimumStayNights"),
    ("maximum_guests", "maximumGuests"),
    ("parking_spaces", "parkingSpaces"),
    ("amenities", "amenities"),
    ("property_description", "description"),
    ("key_selling_points", "keySellingPoints"),
    ("address", "address"),
    ("map_link", "mapLink"),
    ("listing_url", "listingUrl"),
    ("virtual_tour_url", "virtualTourUrl"),
    ("floor_plan_url", "floorPlanUrl"),
];

/// The property's stored row: its ID (kept on the server) and payload.
pub struct Listing {
    pub record: Uuid,
    pub payload: Value,
}

impl Listing {
    /// Each allowlisted field as stored text, if any.
    pub fn facts(&self) -> impl Iterator<Item = (&'static str, Option<&str>)> + '_ {
        FIELDS
            .iter()
            .map(|(stored, shown)| (*shown, self.payload.get(*stored).and_then(Value::as_str)))
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
    let found: Option<(Uuid, Value)> = sqlx::query_as(
        "SELECT id,payload FROM crm_records WHERE workspace_id=$1 AND collection='Properties' \
         AND legacy_id=$2",
    )
    .bind(workspace)
    .bind(property_ref)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(found.map(|(record, payload)| Listing { record, payload }))
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
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn the_review_never_names_the_owner_or_private_fields() {
        let hidden = [
            "contact_id",
            "notes",
            "viewing_instructions",
            "photos_documents_url",
        ];
        let more = [
            "permit_reference",
            "listing_authorization",
            "record_check",
            "property_id",
        ];
        for field in hidden.iter().chain(more.iter()) {
            assert!(FIELDS.iter().all(|(stored, _)| stored != field), "{field}");
        }
        let file = Uuid::new_v4();
        let payload = json!({"media_photos": [{"name": "a.jpg", "file": file}, {"src": "x"}]});
        let listing = Listing {
            record: Uuid::new_v4(),
            payload,
        };
        assert_eq!(
            listing.media("media_photos"),
            vec![("a.jpg".into(), file, None)]
        );
    }
}
