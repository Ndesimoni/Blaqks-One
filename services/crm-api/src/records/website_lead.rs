//! Records-owned lead creation for anonymous website intake. The owning Admin is the
//! record actor; enquiries keeps a separate actor-less event for the visitor submission.
use super::{creation::create_in as create_record, mutation::Entry, validation::validate_new};
use crate::{assignments::eligibility, error::ApiResult, records::history::Change};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub struct Contact<'a> {
    pub name: &'a str,
    pub email: Option<&'a str>,
    pub phone: Option<&'a str>,
    pub message: &'a str,
    pub preference: Option<&'a str>,
}

pub fn payload(contact: &Contact<'_>) -> Value {
    let mut value = json!({"full_name":contact.name,"lead_source":"Website","lead_stage":"New",
        "contact_permission":"Unknown","notes":format!("Website enquiry\n{}",contact.message)});
    if let Some(email) = contact.email {
        value["email"] = json!(email);
    }
    if let Some(phone) = contact.phone {
        value["phone"] = json!(phone);
    }
    if let Some(preference) = contact.preference {
        value["preferred_channel"] = json!(match preference {
            "email" => "Email",
            "whatsapp" => "WhatsApp",
            _ => "Phone",
        });
    }
    value
}

/// Caller holds the workspace lock. Every record command checks live owner access;
/// assignment falls back to the same company's Admin when the representative cannot hold Clients.
pub async fn create_in(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    owner: Uuid,
    representative: Option<Uuid>,
    contact: &Contact<'_>,
) -> ApiResult<Entry> {
    let record = validate_new("Clients", payload(contact))?;
    let mut entry = create_record(tx, owner, workspace, "Clients", record).await?;
    if let Some(member) = representative.filter(|member| *member != owner) {
        if eligibility::can_hold(tx, workspace, "Clients", member).await? {
            let change = Change {
                workspace,
                record: entry.id,
                collection: "Clients",
                from: entry.assignee,
                to: Some(member),
                actor: owner,
                reason: "reassigned",
            };
            eligibility::apply(tx, &change, None).await?;
            entry.assignee = Some(member);
            entry.version += 1;
        }
    }
    Ok(entry)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn website_lead_is_valid_and_does_not_invent_marketing_permission() {
        let contact = Contact {
            name: "Synthetic Visitor",
            email: Some("visitor@example.test"),
            phone: None,
            message: "A synthetic property question.",
            preference: Some("email"),
        };
        let value = payload(&contact);
        assert_eq!(value["lead_source"], "Website");
        assert_eq!(value["contact_permission"], "Unknown");
        assert_eq!(value["preferred_channel"], "Email");
        assert!(validate_new("Clients", value).is_ok());
    }
}
