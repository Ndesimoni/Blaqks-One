use super::publication_source::{self, Source};
use super::publication_source_options as options;
use crate::error::{ApiError, ApiResult};
use serde_json::{json, Value};

fn text<'a>(p: &'a Value, key: &str) -> &'a str {
    p.get(key).and_then(Value::as_str).unwrap_or("").trim()
}
fn number(p: &Value, key: &str) -> f64 {
    p.get(key)
        .and_then(Value::as_f64)
        .or_else(|| text(p, key).replace(',', "").parse().ok())
        .unwrap_or(0.0)
}
fn slug(value: &str) -> String {
    value.to_lowercase().replace(' ', "-")
}
fn field(p: &Value, key: &str, max: usize) -> ApiResult<String> {
    let v = text(p, key);
    if v.is_empty()
        || v.chars().count() > max
        || v.contains(['<', '>'])
        || v.chars().any(|c| {
            c.is_control() && !(key == "property_description" && matches!(c, '\n' | '\r' | '\t'))
        })
    {
        return Err(ApiError::invalid(
            "Complete the public property facts before publishing.",
        ));
    }
    Ok(v.to_owned())
}
pub fn project(p: &Value) -> ApiResult<Source> {
    let emirate = slug(&field(p, "emirate", 60)?);
    if ![
        "dubai",
        "abu-dhabi",
        "sharjah",
        "ajman",
        "umm-al-quwain",
        "ras-al-khaimah",
        "fujairah",
    ]
    .contains(&emirate.as_str())
    {
        return Err(ApiError::invalid("Choose one of the seven emirates."));
    }
    let community = field(p, "community", 100)?;
    let physical_key = publication_source::physical_key(
        &emirate,
        &community,
        &field(p, "building_project", 200)?,
        &field(p, "unit_reference", 100)?,
    )?;
    let purpose = match text(p, "sale_rental").to_ascii_lowercase().as_str() {
        "sale" | "buy" => "buy",
        "rent" | "rental" => "rent",
        "holiday" | "holiday home" | "holiday homes" => "holiday",
        _ => {
            return Err(ApiError::invalid(
                "Choose Sale, Rent or Holiday for this property.",
            ))
        }
    };
    options::price_basis(p, purpose)?;
    let (property_type, commercial) = options::property_type(&field(p, "property_type", 60)?)?;
    if purpose == "holiday" && commercial {
        return Err(ApiError::invalid(
            "Holiday homes must use a residential property type.",
        ));
    }
    let bedroom = if commercial {
        Value::Null
    } else {
        json!(options::count(
            p,
            "bedrooms",
            !text(p, "property_type").eq_ignore_ascii_case("studio")
        )?)
    };
    let price = number(p, "price_annual_rent_aed");
    let size = number(p, "area_sq_ft");
    if !price.is_finite() || price <= 0.0 || !size.is_finite() || size <= 0.0 {
        return Err(ApiError::invalid(
            "Enter a positive price and property size.",
        ));
    }
    let area_id = publication_source::area_id(&emirate, &community);
    let furnishing = slug(text(p, "furnishing"));
    let ready = match text(p, "ready_off_plan").to_ascii_lowercase().as_str() {
        "ready" => "ready",
        "off-plan" => "off-plan",
        _ => {
            return Err(ApiError::invalid(
                "Select Ready or Off-plan before publishing.",
            ))
        }
    };
    let amenities = options::amenities(p);
    let bathrooms = options::count(p, "bathrooms", false)?;
    let parking = options::count(p, "parking_spaces", false)?;
    let guests = if purpose == "holiday" {
        options::count(p, "maximum_guests", true)?
    } else {
        0.0
    };
    let stay = if purpose == "holiday" {
        options::count(p, "minimum_stay_nights", true)?
    } else {
        0.0
    };
    if purpose == "holiday" && (guests < 1.0 || stay < 1.0) {
        return Err(ApiError::invalid(
            "Set a positive guest capacity and minimum stay.",
        ));
    }
    let city = match emirate.as_str() {
        "dubai" => "Dubai",
        "abu-dhabi" => "Abu Dhabi",
        "sharjah" => "Sharjah",
        "ajman" => "Ajman",
        "umm-al-quwain" => "Umm Al Quwain",
        "ras-al-khaimah" => "Ras Al Khaimah",
        _ => "Fujairah",
    };
    let area = json!({"id":area_id,"name":community,"city":city,"emirate":emirate,"image":"","note":"Explore properties in this community."});
    let listing = json!({"area":area_id,"title":field(p,"listing_title",200)?,"type":property_type,"purpose":purpose,"emirate":emirate,
        "category":if commercial{"commercial"}else{"residential"},"bedrooms":bedroom,"bathrooms":bathrooms,"size":size,"price":price,
        "description":field(p,"property_description",8000)?,"ready":ready,"furnishing":furnishing,"market":"",
        "parking":parking,"amenities":amenities,"guests":guests,"minimumStay":stay});
    Ok(Source {
        version: 0,
        physical_key,
        listing,
        area,
        media: publication_source::media(p),
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn private_fields_are_not_projected() {
        let p = json!({"emirate":"Dubai","community":"Dubai Marina","building_project":"Private Tower","unit_reference":"Private unit 123","sale_rental":"Sale","property_type":"Apartment","ready_off_plan":"Ready","bedrooms":0,"listing_title":"Public title","property_description":"Public description","price_annual_rent_aed":100,"area_sq_ft":900,"notes":"SECRET","map_link":"SECRET","address":"SECRET"});
        let source = project(&p).unwrap();
        let public = format!("{}{}", source.listing, source.area);
        assert!(!public.contains("SECRET"));
        assert!(!public.contains("Private"));
    }
}
