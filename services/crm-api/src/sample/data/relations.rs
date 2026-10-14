//! Sample shortlist matches, interaction log entries and client-care touchpoints.
use super::Calendar;
use serde_json::{json, Value};

pub fn shortlist(calendar: &Calendar) -> Vec<Value> {
    let day = |offset| calendar.day(offset);
    vec![
        json!({"match_id": "MT-S01", "client_id": "CL-S01", "property_id": "PR-S01",
            "date_sent": day(-8), "client_response": "Negotiating",
            "next_action": "Agree the final price"}),
        json!({"match_id": "MT-S02", "client_id": "CL-S02", "property_id": "PR-S03",
            "date_sent": day(-4), "client_response": "Viewing requested",
            "next_action": "Hold the viewing slot"}),
        json!({"match_id": "MT-S03", "client_id": "CL-S02", "property_id": "PR-S04",
            "date_sent": day(-4), "client_response": "Not interested",
            "notes": "Sample: prefers to rent for now"}),
        json!({"match_id": "MT-S04", "client_id": "CL-S03", "property_id": "PR-S05",
            "date_sent": day(-5), "client_response": "Interested",
            "next_action": "Book a second viewing"}),
        json!({"match_id": "MT-S05", "client_id": "CL-S05", "property_id": "PR-S09",
            "date_sent": day(-2), "client_response": "Pending",
            "next_action": "Ask for feedback"}),
    ]
}

pub fn interactions(calendar: &Calendar) -> Vec<Value> {
    let day = |offset| calendar.day(offset);
    vec![
        json!({"log_id": "LG-S01", "contacted_on_uae_time": calendar.at(-1, "14:30"),
            "client_id": "CL-S01", "channel": "WhatsApp", "direction": "Outbound",
            "conversation_topic": "Negotiation",
            "conversation_summary_client_needs": "Sample: ready to proceed at the right price",
            "objection_category": "Price", "exact_objection_concern": "Asking price above budget",
            "commitment_made": "Send the seller's counter-offer", "next_action": "Call the seller",
            "action_due": day(0), "action_status": "Open", "property_id_optional": "PR-S01"}),
        json!({"log_id": "LG-S02", "contacted_on_uae_time": calendar.at(-1, "10:00"),
            "client_id": "CL-S06", "channel": "Phone", "direction": "Inbound",
            "conversation_topic": "Documentation",
            "conversation_summary_client_needs": "Sample: needs the lease before month end",
            "commitment_made": "Draft the tenancy contract", "next_action": "Email the draft",
            "action_due": day(2), "action_status": "In progress",
            "property_id_optional": "PR-S08"}),
        json!({"log_id": "LG-S03", "contacted_on_uae_time": calendar.at(-9, "12:15"),
            "client_id": "CL-S08", "channel": "Email", "direction": "Outbound",
            "conversation_topic": "Financing",
            "conversation_summary_client_needs": "Sample: mortgage not approved this year",
            "objection_category": "Financing", "next_action": "Re-engage after the review date",
            "action_due": day(60), "action_status": "Open"}),
        json!({"log_id": "LG-S04", "contacted_on_uae_time": calendar.at(-2, "19:45"),
            "client_id": "CL-S04", "channel": "WhatsApp", "direction": "Inbound",
            "conversation_topic": "New enquiry",
            "conversation_summary_client_needs": "Sample: relocating, wants options in March",
            "objection_category": "Timing", "next_action": "Send the first shortlist",
            "action_due": day(5), "action_status": "Open"}),
    ]
}

pub fn care(calendar: &Calendar) -> Vec<Value> {
    let day = |offset| calendar.day(offset);
    vec![
        json!({"care_id": "CA-S01", "client_id": "CL-S07", "touchpoint_type": "Post-sale check-in",
            "property_id_optional": "PR-S12", "last_contact": day(-20), "next_contact": day(10),
            "client_relationship": "Past client", "referral_outcome": "Not yet",
            "preferences_interests": "Sample: interested in a second investment unit",
            "task_status": "Open"}),
        json!({"care_id": "CA-S02", "client_id": "CL-S07", "touchpoint_type": "Referral request",
            "last_contact": day(-6), "next_contact": day(30), "client_relationship": "Investor",
            "referral_outcome": "Referral received", "referred_client_id": "CL-S10",
            "conversation_notes": "Sample: introduced a colleague looking in JVC",
            "task_status": "Completed"}),
        json!({"care_id": "CA-S03", "client_id": "CL-S01", "touchpoint_type": "General check-in",
            "last_contact": day(-1), "next_contact": day(7), "client_relationship": "Active",
            "referral_outcome": "None", "task_status": "Open"}),
    ]
}
