//! Which client a WhatsApp Start message or a record's consent is for (W1b, design §18).
//! The record's phone becomes its canonical key (`normalize::whatsapp_key`); a national
//! form is read only as a UAE mobile, so the member must send back the number the start
//! state showed them (`expectedPhone`). A missing or different value means the number they
//! confirmed is not the one the CRM would use (W1b security review M1).
use super::conflict;
use crate::{
    error::{ApiError, ApiResult},
    inbox::normalize,
};
use serde_json::{Map, Value};
use uuid::Uuid;

pub const START: &str = "Choose a client or contact and a WhatsApp template or message.";
pub const NO_PHONE: &str =
    "This record has no number WhatsApp can use. Save it in international form, starting with + or 00.";
pub const PHONE_CHANGED: &str = "The client's number changed. Check it and try again.";

/// `collection` and `recordId`, taken out of the request.
pub fn record(map: &mut Map<String, Value>) -> ApiResult<(String, Uuid)> {
    let collection = map
        .remove("collection")
        .and_then(|value| value.as_str().map(str::to_owned))
        .filter(|value| matches!(value.as_str(), "Clients" | "Contacts"));
    let record = map
        .remove("recordId")
        .and_then(|value| value.as_str().and_then(|text| Uuid::parse_str(text).ok()));
    collection.zip(record).ok_or(ApiError::invalid(START))
}

/// `expectedPhone`, taken out of the request (absent or not text is `None`).
pub fn expected(map: &mut Map<String, Value>) -> Option<String> {
    map.remove("expectedPhone")
        .and_then(|value| value.as_str().map(str::to_owned))
}

/// The record's WhatsApp key, which must equal the number the member confirmed.
pub fn confirmed(phone: Option<&str>, expected: Option<&str>) -> ApiResult<String> {
    let key = phone
        .and_then(normalize::whatsapp_key)
        .ok_or(ApiError::invalid(NO_PHONE))?;
    if expected != Some(key.as_str()) {
        return Err(conflict(PHONE_CHANGED, "phone_changed"));
    }
    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_confirmed_number_must_be_the_derived_key() {
        let key = "+971501234567";
        assert_eq!(confirmed(Some("050 123 4567"), Some(key)).unwrap(), key);
        for wrong in [None, Some("050 123 4567"), Some("+966501234567"), Some("")] {
            let refused = confirmed(Some("050 123 4567"), wrong).unwrap_err();
            assert_eq!((refused.0.as_u16(), refused.2), (409, "phone_changed"));
        }
        let refused = confirmed(Some("4 123 4567"), Some(key)).unwrap_err();
        assert_eq!((refused.0.as_u16(), refused.1), (400, NO_PHONE));
        assert_eq!(confirmed(None, None).unwrap_err().1, NO_PHONE);
    }
}
