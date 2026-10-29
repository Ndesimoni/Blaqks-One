use super::{model::PublishInput, prepare::Prepared};
use serde_json::{json, Value};
use uuid::Uuid;

pub fn build(
    prepared: &Prepared,
    input: &PublishInput,
    id: Uuid,
    photos: &[Uuid],
    plans: &[Uuid],
) -> Value {
    let mut listing = prepared.source.listing.clone();
    let paths = |files: &[Uuid]| {
        files
            .iter()
            .map(|file| format!("/api/public/v1/media/{file}"))
            .collect::<Vec<_>>()
    };
    let photos = paths(photos);
    let plans = paths(plans);
    listing["id"] = json!(id);
    listing["agent"] = json!(prepared.profile.id);
    listing["company"] = json!(prepared.company.id);
    listing["developer"] = json!(input.developer);
    listing["market"] = json!(if listing["purpose"] == "buy" {
        input.market.as_deref().unwrap_or("")
    } else {
        ""
    });
    listing["photos"] = json!(photos);
    listing["floorPlans"] = json!(plans);
    listing["image"] = json!(photos[0]);
    listing["publishedAt"] = json!(time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default());
    listing["reference"] = json!(format!("BO-{}", &id.simple().to_string()[..12]));
    listing["advertisingPermit"] = json!(input.permit_reference);
    let mut area = prepared.source.area.clone();
    area["image"] = listing["image"].clone();
    json!({"listing":listing,"area":area})
}
