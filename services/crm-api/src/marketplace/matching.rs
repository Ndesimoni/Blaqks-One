//! Exact server-side must-match rules; only caller-owned listing facts enter this function.
use super::requests::Row;
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
    records::{market_listings, outside_facts},
};
use serde_json::{json, Map, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn own_matches(
    tx: &mut Transaction<'_, Postgres>,
    user: &UserRow,
    request: &Row,
) -> ApiResult<Vec<(Uuid, Value)>> {
    let listings = market_listings::held(tx, user).await?;
    if listings.len() > 1000 {
        return Err(ApiError::conflict(
            "Narrow your inventory before matching this request.",
        ));
    }
    Ok(listings
        .into_iter()
        .filter_map(|(id, payload)| {
            let found = checklist(request, &outside_facts::read(&payload).facts);
            (found["matches"] == true).then_some((id, found))
        })
        .collect())
}

fn key(text: &str) -> String {
    text.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}
fn number(value: Option<&Value>) -> Option<f64> {
    value
        .and_then(|v| {
            v.as_f64()
                .or_else(|| v.as_str()?.replace(',', "").parse().ok())
        })
        .filter(|v| v.is_finite() && *v >= 0.0)
}
pub fn checklist(request: &Row, facts: &Map<String, Value>) -> Value {
    let text = |name| facts.get(name).and_then(Value::as_str).unwrap_or("");
    let price = number(facts.get("priceAed"));
    let budget = price.is_some_and(|p| {
        p > 0.0
            && p <= request.budget_max_aed as f64 * 1.1
            && request.budget_min_aed.is_none_or(|min| p >= min as f64)
    });
    let area = request.open_to_other_areas
        || request.communities.0.is_empty()
        || request
            .communities
            .0
            .iter()
            .any(|c| c.key == key(text("community")));
    let checks = json!({
        "purpose": match request.purpose.as_str() {"buy" => text("saleRental")=="Sale",_=>text("saleRental")=="Rental" || text("saleRental")=="Rent"},
        "emirate": key(text("emirate")).replace(' ',"-")==request.emirate,
        "propertyType": text("propertyType")==request.property_type,
        "bedrooms": request.bedrooms.is_none_or(|b| number(facts.get("bedrooms"))==Some(b as f64)),
        "budget": budget, "area": area, "available": text("listingStatus")=="Available"
    });
    let matches = checks
        .as_object()
        .is_some_and(|c| c.values().all(|v| v == true));
    let wanted_ready = match request.ready.as_str() {
        "ready" => "Ready",
        "off_plan" => "Off-plan",
        _ => "",
    };
    let wanted_furnishing = match request.furnishing.as_str() {
        "part_furnished" => "Part furnished",
        "furnished" => "Furnished",
        "unfurnished" => "Unfurnished",
        _ => "",
    };
    let compare = |actual: &str, wanted: &str| {
        if actual.is_empty() || wanted.is_empty() {
            None
        } else {
            Some(key(actual) == key(wanted))
        }
    };
    let preferences = json!({
        "ready":compare(text("readyOffPlan"),wanted_ready),
        "furnishing":compare(text("furnishing"),wanted_furnishing),
        "cheques":request.cheques.and_then(|wanted|number(facts.get("rentalCheques")).map(|actual|actual>=wanted as f64)),
        "buildingAge":null,
        "moveIn":request.move_in.as_deref().and_then(|wanted|text("availableFrom").get(..7).map(|actual|actual<=wanted))
    });
    json!({"matches":matches,"checks":checks,"preferences":preferences,"overBudget":price.is_some_and(|p|p>request.budget_max_aed as f64)})
}
