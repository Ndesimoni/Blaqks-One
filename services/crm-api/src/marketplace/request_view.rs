//! What a request shows (packet MK2): the shared facts on the board and in My requests. Never the
//! client, the source record, the exact budget or the poster's contact details.
use super::requests::{state, Row};
use serde_json::{json, Map, Value};
use uuid::Uuid;

/// The facts every viewer may see, including both dates and the band instead of the budget.
pub fn facts(row: &Row) -> Map<String, Value> {
    let communities: Vec<String> = row
        .communities
        .0
        .iter()
        .map(|entry| entry.name.clone())
        .collect();
    let value = json!({
        "id": row.id,
        "purpose": row.purpose,
        "emirate": row.emirate,
        "communities": communities,
        "openToOtherAreas": row.open_to_other_areas,
        "propertyType": row.property_type,
        "bedrooms": row.bedrooms,
        "budgetBand": row.budget_band,
        "ready": row.ready,
        "furnishing": row.furnishing,
        "cheques": row.cheques,
        "buildingAge": row.building_age,
        "moveIn": row.move_in,
        "createdAt": row.created_at,
        "expiresAt": row.expires_at,
    });
    match value {
        Value::Object(map) => map,
        _ => Map::new(),
    }
}

/// One row of My requests: the facts, the state, the client and what the poster may do next. The
/// exact budget is the poster's own, so it travels here and never on the board.
pub fn mine(row: &Row, client: Option<Uuid>, name: Option<&str>) -> Value {
    let mut item = facts(row);
    item.insert("clientId".to_owned(), json!(client));
    item.insert("clientName".to_owned(), json!(name));
    item.insert("state".to_owned(), json!(state(row)));
    item.insert("canRenew".to_owned(), json!(row.renewable));
    item.insert("version".to_owned(), json!(row.version));
    item.insert("budgetMinAed".to_owned(), json!(row.budget_min_aed));
    item.insert("budgetMaxAed".to_owned(), json!(row.budget_max_aed));
    Value::Object(item)
}

/// One card on the board: the facts and who posted it.
pub fn board(row: &Row, broker: Value) -> Value {
    let mut item = facts(row);
    item.insert("broker".to_owned(), broker);
    Value::Object(item)
}
