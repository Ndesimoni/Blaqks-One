//! Creating a lead (a Client in stage New) for a conversation's sender, through the
//! records module inside the caller's transaction, which already holds the workspace lock.
use super::normalize::Contact;
use crate::{
    error::ApiResult,
    records::{creation::create_in, mutation::Entry, validation::validate_new},
};
use serde_json::{json, Map, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// The Lead source option for a channel; WhatsApp and email have no option of their own.
fn lead_source(channel: &str) -> &'static str {
    match channel {
        "facebook" => "Facebook",
        "instagram" => "Instagram",
        "tiktok" => "TikTok",
        _ => "Other",
    }
}

fn preferred_channel(channel: &str) -> Option<&'static str> {
    match channel {
        "whatsapp" => Some("WhatsApp"),
        "email" => Some("Email"),
        _ => None,
    }
}

/// The new Client's fields: name, the normalised phone or email, source, stage New and
/// contact permission Unknown (consent is recorded separately before any send).
pub fn payload(channel: &str, contact: &Contact, name: Option<&str>, notes: Option<&str>) -> Value {
    let mut record = Map::new();
    let name = name
        .filter(|name| !name.trim().is_empty())
        .unwrap_or(&contact.display);
    record.insert("full_name".into(), json!(name));
    if let Some(digits) = &contact.phone_digits {
        record.insert("phone".into(), json!(format!("+{digits}")));
    }
    if let Some(email) = &contact.email {
        record.insert("email".into(), json!(email));
    }
    record.insert("lead_source".into(), json!(lead_source(channel)));
    record.insert("lead_stage".into(), json!("New"));
    record.insert("contact_permission".into(), json!("Unknown"));
    if let Some(preferred) = preferred_channel(channel) {
        record.insert("preferred_channel".into(), json!(preferred));
    }
    let notes = notes
        .filter(|text| !text.trim().is_empty())
        .unwrap_or("Created from the Inbox.");
    record.insert("notes".into(), json!(notes));
    Value::Object(record)
}

/// Creates the lead as `actor`, whose live membership and Clients create grant the
/// records module checks again.
pub async fn create(
    transaction: &mut Transaction<'_, Postgres>,
    actor: Uuid,
    workspace: &str,
    channel: &str,
    contact: &Contact,
    name: Option<&str>,
    notes: Option<&str>,
) -> ApiResult<Entry> {
    let record = validate_new("Clients", payload(channel, contact, name, notes))?;
    create_in(transaction, actor, workspace, "Clients", record).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::inbox::normalize::contact;

    #[test]
    fn a_lead_carries_only_what_the_message_proved() {
        let sender = contact("whatsapp", "050 000 0001").unwrap();
        let lead = payload("whatsapp", &sender, Some("Synthetic Lead"), None);
        assert_eq!(lead["notes"], "Created from the Inbox.");
        let checked = payload("whatsapp", &sender, None, Some("Rent · 2BR · JVC"));
        assert_eq!(checked["notes"], "Rent · 2BR · JVC");
        assert_eq!(lead["full_name"], "Synthetic Lead");
        assert_eq!(lead["phone"], "+971500000001");
        assert!(lead.get("email").is_none());
        assert_eq!(lead["lead_stage"], "New");
        assert_eq!(lead["preferred_channel"], "WhatsApp");
        let social = contact("tiktok", "user_1").unwrap();
        let unnamed = payload("tiktok", &social, Some("  "), None);
        assert_eq!(unnamed["full_name"], "user_1");
        assert_eq!(unnamed["lead_source"], "TikTok");
        assert!(validate_new("Clients", unnamed).is_ok());
    }
}
