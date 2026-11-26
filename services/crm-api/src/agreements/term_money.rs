//! Typed monetary terms. Legacy co-broking offers without a collector remain readable.
use super::{
    model::{Kind, INVALID},
    wire,
};
use crate::error::{ApiError, ApiResult};
use serde_json::{json, Value};

pub fn build(kind: Kind, input: &Value) -> ApiResult<Value> {
    let mut input = input.clone();
    let collector = input
        .as_object_mut()
        .and_then(|map| map.remove("collectingParty"));
    if collector.is_some() && kind != Kind::CoBroking {
        return Err(ApiError::invalid(INVALID));
    }
    let keys = ["basis", "amountFils", "senderShareBp", "paymentExpectation"];
    let money = wire::exact(input, &keys, INVALID)?;
    let sender = wire::node(&money, "senderShareBp")?
        .as_i64()
        .ok_or(ApiError::invalid(INVALID))?;
    let (sender, recipient) = kind.shares(sender)?;
    let mut result = json!({
        "basis": wire::one_of(wire::node(&money,"basis")?, &["commission","fixed"])?,
        "amountFils": wire::amount(wire::node(&money,"amountFils")?)?,
        "senderShareBp": sender,
        "recipientShareBp": recipient,
        "paymentExpectation": wire::one_of(wire::node(&money,"paymentExpectation")?,
            &["on_transfer","on_receipt","on_completion"])?,
    });
    if let Some(collector) = collector {
        result["collectingParty"] = json!(wire::one_of(&collector, &["sender", "recipient"])?);
    }
    Ok(result)
}
