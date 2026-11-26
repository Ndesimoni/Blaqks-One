//! Strict deal bodies (finance-design §6.2, §13 L-F3, L-F6): integers only for money and
//! rates, closed option lists, split fields refused, and server-issued IDs.
use super::{
    details,
    fields::{money, nullable, option, reference, STAGES, TYPES},
};
use crate::{
    error::{ApiError, ApiResult},
    finance::wire,
};
use serde_json::{Map, Value};

pub const INVALID: &str = "Provide valid deal details.";
pub use super::fields::MONEY;
pub const ISSUED: &str = "Record IDs are issued by the server.";
pub const SPLIT_PANEL: &str = "Change the split from the split panel.";
pub const CLIENT: &str = "Choose a client for this deal.";
pub const FEE: &str = "Enter the fee rate or fixed fee for the chosen fee basis.";
const REQUIRED: [&str; 6] = [
    "clientId",
    "dealType",
    "stage",
    "agreedValueFils",
    "feeBasis",
    "details",
];
const OPTIONAL: [&str; 5] = [
    "propertyId",
    "feeRateBp",
    "fixedFeeFils",
    "partnerShareBp",
    "partnerName",
];
const SPLIT: [&str; 5] = [
    "secondAgentId",
    "secondAgentShareBp",
    "overrideAgentShareBp",
    "overrideReason",
    "secondAgent",
];

#[derive(Clone, Debug, PartialEq)]
pub struct DealInput {
    /// Present only on a PATCH that echoes the ID; it must match the stored ID.
    pub deal_id: Option<String>,
    pub client_ref: String,
    pub property_ref: Option<String>,
    pub deal_type: &'static str,
    pub stage: &'static str,
    pub agreed_value_fils: i64,
    pub fee_basis: &'static str,
    pub fee_rate_bp: Option<i32>,
    pub fixed_fee_fils: Option<i64>,
    pub partner_share_bp: i32,
    pub partner_name: Option<String>,
    pub details: Map<String, Value>,
}

/// The `deal` object of a create (`creating`) or PATCH body.
pub fn parse(deal: &Value, creating: bool) -> ApiResult<DealInput> {
    let Value::Object(deal) = deal else {
        return Err(ApiError::invalid(INVALID));
    };
    if creating && deal.contains_key("dealId") {
        return Err(ApiError::invalid(ISSUED));
    }
    if SPLIT.iter().any(|key| deal.contains_key(*key)) {
        return Err(ApiError::invalid(SPLIT_PANEL));
    }
    let known = |key: &String| {
        REQUIRED.contains(&key.as_str()) || OPTIONAL.contains(&key.as_str()) || key == "dealId"
    };
    if !deal.keys().all(known) || !REQUIRED.iter().all(|key| deal.contains_key(*key)) {
        return Err(ApiError::invalid(INVALID));
    }
    let deal_id = match deal.get("dealId") {
        None => None,
        Some(Value::String(id)) => Some(id.clone()),
        Some(_) => return Err(ApiError::invalid(INVALID)),
    };
    let client_ref = reference(deal.get("clientId"), CLIENT)?.ok_or(ApiError::invalid(CLIENT))?;
    let fee_basis = option(
        &deal["feeBasis"],
        &["percentage", "fixed"],
        "Choose a valid fee basis.",
    )?;
    let fee_rate_bp = nullable(deal.get("feeRateBp"), wire::bp)?;
    let fixed_fee_fils = nullable(deal.get("fixedFeeFils"), money)?;
    let complete = match fee_basis {
        "percentage" => fee_rate_bp.is_some(),
        _ => fixed_fee_fils.is_some(),
    };
    let partner_name = match deal.get("partnerName") {
        None | Some(Value::Null) => None,
        Some(Value::String(name)) if name.trim().chars().count() <= 200 => {
            Some(name.trim().to_string()).filter(|name| !name.is_empty())
        }
        Some(_) => return Err(ApiError::invalid(INVALID)),
    };
    let input = DealInput {
        deal_id,
        client_ref,
        property_ref: reference(deal.get("propertyId"), INVALID)?,
        deal_type: option(&deal["dealType"], &TYPES, "Choose a valid deal type.")?,
        stage: option(&deal["stage"], &STAGES, "Choose a valid deal stage.")?,
        agreed_value_fils: money(&deal["agreedValueFils"])?,
        fee_basis,
        fee_rate_bp,
        fixed_fee_fils,
        partner_share_bp: nullable(deal.get("partnerShareBp"), wire::bp)?.unwrap_or(0),
        partner_name,
        details: details::parse(&deal["details"])?,
    };
    complete.then_some(input).ok_or(ApiError::invalid(FEE))
}

#[cfg(test)]
#[path = "input_tests.rs"]
mod tests;
