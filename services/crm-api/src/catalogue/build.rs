use crate::{
    error::{ApiError, ApiResult},
    publications, sites,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use std::collections::{BTreeMap, BTreeSet};

pub async fn catalogue(
    tx: &mut Transaction<'_, Postgres>,
    site: &sites::SiteRow,
) -> ApiResult<Value> {
    let mut catalogue = sites::catalogue(tx, site).await?;
    let publications = publications::visible(tx, site).await?;
    let mut areas = BTreeMap::new();
    let mut listings = Vec::new();
    for publication in publications {
        let mut listing = publication.listing();
        let media = |id: &uuid::Uuid| {
            let query = url::form_urlencoded::Serializer::new(String::new())
                .append_pair("host", &site.host)
                .finish();
            format!("/api/public/v1/sites/{}/media/{}?{}", site.id, id, query)
        };
        let photos: Vec<String> = publication.photos.iter().map(media).collect();
        listing["id"] = json!(publication.id);
        listing["image"] = json!(photos.first().ok_or_else(ApiError::missing)?);
        listing["photos"] = json!(photos);
        listing["floorPlans"] = json!(publication
            .floor_plans
            .iter()
            .map(media)
            .collect::<Vec<_>>());
        let mut area = publication.area();
        area["image"] = listing["image"].clone();
        if let Some(id) = area["id"].as_str() {
            areas.insert(id.to_owned(), area);
        }
        listings.push(listing);
    }
    catalogue["listings"] = json!(listings);
    catalogue["areas"] = json!(areas.into_values().collect::<Vec<_>>());
    catalogue["developers"] = json!(super::developers::all());
    counts(&mut catalogue);
    for key in ["companies", "agents", "areas", "developers"] {
        if catalogue[key].as_array().is_none_or(|a| a.len() > 500) {
            return Err(ApiError::conflict("The public directory needs pagination."));
        }
    }
    Ok(catalogue)
}
fn counts(catalogue: &mut Value) {
    let listings = catalogue["listings"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    for (collection, field) in [
        ("companies", "company"),
        ("agents", "agent"),
        ("areas", "area"),
        ("developers", "developer"),
    ] {
        if let Some(items) = catalogue[collection].as_array_mut() {
            for item in items {
                let id = item["id"].clone();
                let matches: Vec<&Value> = listings.iter().filter(|p| p[field] == id).collect();
                item["publicListingCount"] = json!(matches.len());
                if collection == "companies" {
                    let agents: BTreeSet<&str> =
                        matches.iter().filter_map(|p| p["agent"].as_str()).collect();
                    item["publicAgentCount"] = json!(agents.len());
                }
            }
        }
    }
}
pub fn included(catalogue: &Value, listings: Vec<Value>) -> Value {
    let mut result = catalogue.clone();
    result["listings"] = json!(listings);
    result
}
