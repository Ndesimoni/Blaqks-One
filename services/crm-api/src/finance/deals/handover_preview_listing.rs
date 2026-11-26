//! The listing in a hand-over review (agreements design §17–§18, review L3).
use super::handover_preview_view::text;
use crate::records::handover_listing::Listing;
use serde_json::{json, Map, Value};

/// The listing: the allowlisted facts and the stored photos and floor plans, which the
/// review loads through `preview/files/{file}`. Only the twelve basic facts, without
/// photos, unless `full` (the sender holds the listing; review L3).
pub fn property(listing: &Listing, full: bool) -> Value {
    let long = ["description", "keySellingPoints", "amenities"];
    let mut value: Map<String, Value> = listing
        .facts(full)
        .map(|(name, stored)| {
            let max = if long.contains(&name) { 2000 } else { 200 };
            (name.to_owned(), text(stored, max))
        })
        .collect();
    let media = |field: &str| -> Value {
        let shown = if full {
            listing.media(field)
        } else {
            Vec::new()
        };
        let entries = shown.into_iter();
        Value::Array(
            entries
                .map(|(name, file, thumb)| json!({"name": name, "file": file, "thumb": thumb}))
                .collect(),
        )
    };
    value.insert("photos".into(), media("media_photos"));
    value.insert("floorPlans".into(), media("media_floorplans"));
    Value::Object(value)
}
