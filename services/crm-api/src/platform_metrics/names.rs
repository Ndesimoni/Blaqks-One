//! The event names in the platform log (docs/blaqks-one-console.md §3a). A name never
//! changes once events carry it; new actions add new names in the module that owns them.

// Identity and team (usage events).
pub const SIGN_UP_FINISHED: &str = "sign_up_finished";
pub const SIGN_IN: &str = "sign_in";
pub const INVITATION_SENT: &str = "invitation_sent";
pub const INVITATION_ACCEPTED: &str = "invitation_accepted";

// Records (usage events, one per collection: `record_created_follow_ups`).
pub const RECORD_CREATED: &str = "record_created";
pub const RECORD_DELETED: &str = "record_deleted";
pub const IMPORT_COMMITTED: &str = "import_committed";

// Money (amount only, never the company).
pub const DEAL_EARNED: &str = "deal_earned";
pub const PAYMENT_APPROVED: &str = "payment_approved";
pub const AGREEMENT_ACCEPTED: &str = "agreement_accepted";
pub const COMMISSION_SHARED: &str = "commission_shared";

// Deals and websites (usage events).
pub const DEAL_LOST: &str = "deal_lost";
pub const LISTING_PUBLISHED: &str = "listing_published";
pub const LISTING_WITHDRAWN: &str = "listing_withdrawn";
pub const ENQUIRY_RECEIVED: &str = "enquiry_received";
pub const ENQUIRY_LEAD_CREATED: &str = "enquiry_lead_created";

// Marketplace and messages (usage events; counts only, never content).
pub const MARKET_REQUEST_POSTED: &str = "market_request_posted";
pub const MARKET_ANSWER_SENT: &str = "market_answer_sent";
pub const EMAIL_SENT: &str = "email_sent";
pub const WHATSAPP_SENT: &str = "whatsapp_sent";
pub const MESSAGE_SENT: &str = "message_sent";
pub const CHAT_MESSAGE_SENT: &str = "chat_message_sent";

/// The event for a record created in or deleted from `collection`, as in
/// `record_created_follow_ups`.
pub fn record_event(base: &str, collection: &str) -> String {
    let key = match collection {
        "Clients" => "clients",
        "Contacts" => "contacts",
        "Properties" => "properties",
        "Follow-ups" => "follow_ups",
        "Viewings" => "viewings",
        "Shortlist" => "shortlist",
        "Interaction log" => "interaction_log",
        "Client care" => "client_care",
        _ => "other",
    };
    format!("{base}_{key}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn record_events_name_the_collection_in_snake_case() {
        assert_eq!(
            record_event(RECORD_CREATED, "Follow-ups"),
            "record_created_follow_ups"
        );
        assert_eq!(
            record_event(RECORD_DELETED, "Interaction log"),
            "record_deleted_interaction_log"
        );
    }
}
