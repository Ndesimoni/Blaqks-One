use super::{build, query::PublicQuery, search};
use crate::{
    error::{ApiError, ApiResult},
    publications, sites,
    state::AppState,
};
use axum::{
    extract::{Path, RawQuery, State},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};

pub async fn resolve(
    State(state): State<AppState>,
    RawQuery(raw): RawQuery,
) -> ApiResult<Json<Value>> {
    let query = PublicQuery::parse(raw.as_deref())?;
    let mut tx = state.pool.begin().await?;
    let site = sites::resolve(&mut tx, query.get("host")).await?;
    tx.commit().await?;
    Ok(Json(json!({"data":site.dto()})))
}
pub async fn collection(
    State(state): State<AppState>,
    Path((id, resource)): Path<(String, String)>,
    RawQuery(raw): RawQuery,
) -> ApiResult<Json<Value>> {
    let query = PublicQuery::parse(raw.as_deref())?;
    if ![
        "home",
        "listings",
        "companies",
        "agents",
        "developers",
        "areas",
    ]
    .contains(&resource.as_str())
    {
        return Err(ApiError::missing());
    }
    let mut tx = state.pool.begin().await?;
    let site = sites::by_id(&mut tx, &id, query.get("host")).await?;
    let catalogue = build::catalogue(&mut tx, &site).await?;
    let result = match resource.as_str() {
        "home" => {
            let mut listings = catalogue["listings"]
                .as_array()
                .cloned()
                .unwrap_or_default();
            search::sort(&mut listings, "newest");
            listings.truncate(6);
            json!({"data":build::included(&catalogue,listings)})
        }
        "listings" => search::listings(&catalogue, &query),
        _ => search::directory(&catalogue, &resource, &query),
    };
    tx.commit().await?;
    Ok(Json(result))
}
pub async fn detail(
    State(state): State<AppState>,
    Path((site_id, resource, id)): Path<(String, String, String)>,
    RawQuery(raw): RawQuery,
) -> ApiResult<Response> {
    let query = PublicQuery::parse(raw.as_deref())?;
    let mut tx = state.pool.begin().await?;
    let site = sites::by_id(&mut tx, &site_id, query.get("host")).await?;
    if resource == "media" {
        let file = uuid::Uuid::parse_str(&id).map_err(|_| ApiError::missing())?;
        let response = publications::public_file(&state, &mut tx, &site, file).await?;
        tx.commit().await?;
        return Ok(response);
    }
    if !["listings", "companies", "agents", "developers", "areas"].contains(&resource.as_str()) {
        return Err(ApiError::missing());
    }
    let catalogue = build::catalogue(&mut tx, &site).await?;
    let entity = catalogue[&resource]
        .as_array()
        .and_then(|items| items.iter().find(|v| v["id"].as_str() == Some(&id)))
        .cloned()
        .ok_or_else(ApiError::missing)?;
    let relation = match resource.as_str() {
        "companies" => "company",
        "agents" => "agent",
        "developers" => "developer",
        "areas" => "area",
        _ => "id",
    };
    let mut listings: Vec<Value> = catalogue["listings"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|v| v[relation].as_str() == Some(&id))
        .cloned()
        .collect();
    search::sort(&mut listings, "newest");
    listings.truncate(12);
    let result = json!({"data":entity,"included":build::included(&catalogue,listings)});
    tx.commit().await?;
    Ok(Json(result).into_response())
}
