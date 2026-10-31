//! Co-broking agreements made from a listing share (docs/record-sharing.md R2): the
//! property comes from the share's frozen snapshot and `introduction` names the share, so
//! every revision's digest is bound to the introduction. Later revisions keep both,
//! whatever the input says; migration 0072 refuses any revision that changes them.
use super::{
    handover_terms,
    model::Kind,
    terms::{self, BuiltTerms},
};
use crate::{
    error::{ApiError, ApiResult},
    records::handover_facts::PropertyFacts,
};
use serde_json::{json, Value};
use time::OffsetDateTime;

/// The §6 property facts of a snapshot's facts, with the share's reference.
pub fn property(facts: &Value, reference: &str) -> Value {
    let text = |key: &str| facts.get(key).and_then(Value::as_str).map(str::to_owned);
    let mut property = handover_terms::property(&PropertyFacts {
        emirate: text("emirate"),
        community: text("community"),
        property_type: text("propertyType"),
        bedrooms: text("bedrooms"),
        size_sqft: text("sizeSqft"),
        price_aed: text("priceAed"),
    });
    property["listingRef"] = json!(reference);
    property
}

/// Terms with the server's `property` and `introduction`, whatever the input's property.
pub fn bound(
    kind: Kind,
    input: &Value,
    property: &Value,
    introduction: &Value,
    now: OffsetDateTime,
) -> ApiResult<BuiltTerms> {
    let mut safe = input.clone();
    if introduction["marketplace"] == true {
        safe.as_object_mut()
            .ok_or_else(|| ApiError::invalid("Provide valid agreement terms."))?
            .insert(
                "client".into(),
                json!({"displayName":"Marketplace client","contact":null}),
            );
    }
    let mut built = terms::build_with(kind, &safe, Some(property), now)?;
    if built.value["money"]["collectingParty"].is_null() {
        return Err(ApiError::invalid("Choose the company collecting the fee."));
    }
    built.value["introduction"] = introduction.clone();
    Ok(built)
}

/// The terms of a new revision, bound to the introduction when the `current` ones are.
pub fn rebuild(
    kind: Kind,
    input: &Value,
    current: &Value,
    now: OffsetDateTime,
) -> ApiResult<BuiltTerms> {
    match current.get("introduction").filter(|value| !value.is_null()) {
        Some(introduction) => {
            let property = &current["subject"]["property"];
            bound(kind, input, property, introduction, now)
        }
        None => terms::build(kind, input, now),
    }
}
