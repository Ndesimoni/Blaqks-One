//! Intercompany due: integer fils, 128-bit multiplication and half-up rounding.
use super::model::Party;
use crate::error::{ApiError, ApiResult};
use serde_json::Value;

pub const UNAVAILABLE: &str = "Payments are unavailable for these agreement terms.";
pub fn due(kind: &str, terms: &Value) -> ApiResult<(Party, i64)> {
    let money = &terms["money"];
    let payer = match kind {
        "handover_referral" => Party::Recipient,
        "co_broking" => match money["collectingParty"].as_str() {
            Some("sender") => Party::Sender,
            Some("recipient") => Party::Recipient,
            _ => return Err(ApiError::conflict(UNAVAILABLE)),
        },
        _ => return Err(ApiError::conflict(UNAVAILABLE)),
    };
    let amount = money["amountFils"]
        .as_i64()
        .filter(|v| *v > 0)
        .ok_or(ApiError::conflict(UNAVAILABLE))?;
    let key = if payer == Party::Recipient {
        "senderShareBp"
    } else {
        "recipientShareBp"
    };
    let share = money[key]
        .as_i64()
        .filter(|v| (1..=9999).contains(v))
        .ok_or(ApiError::conflict(UNAVAILABLE))?;
    Ok((
        payer,
        ((i128::from(amount) * i128::from(share) + 5000) / 10000) as i64,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn rounds_half_up_without_overflow_and_uses_collector() {
        let mut terms =
            json!({"money":{"amountFils":5,"senderShareBp":1000,"recipientShareBp":9000}});
        assert_eq!(
            due("handover_referral", &terms).unwrap(),
            (Party::Recipient, 1)
        );
        assert!(due("co_broking", &terms).is_err());
        terms["money"]["collectingParty"] = json!("sender");
        assert_eq!(due("co_broking", &terms).unwrap(), (Party::Sender, 5));
        terms["money"]["amountFils"] = json!(10_000_000_000_000_i64);
        assert_eq!(due("co_broking", &terms).unwrap().1, 9_000_000_000_000);
    }
}
