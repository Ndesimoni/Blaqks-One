//! Sample clients across the pipeline: hot leads, early leads, closed, lost and on hold.
use super::{email, merge, name, phone, Calendar, NOTE};
use serde_json::{json, Value};

/// Adds the shared defaults, labelled name, fictional phone and email to one lead.
/// `person` is a builder-only key and never reaches the stored payload.
fn client(calendar: &Calendar, number: u16, mut lead: Value) -> Value {
    let person = lead["person"].as_str().unwrap_or_default().to_owned();
    if let Some(fields) = lead.as_object_mut() {
        fields.remove("person");
    }
    let buyer = lead["buy_rent"] == "Buy";
    let base = json!({
        "full_name": name(&person),
        "phone": phone(number),
        "email": email(&person),
        "preferred_language": "English",
        "client_type": if buyer { "Buyer" } else { "Tenant" },
        "lead_source": "Property Finder",
        "emirate": "Dubai",
        "property_type": "Apartment",
        "bedrooms": 2,
        "priority": "Medium",
        "date_added": calendar.day(-(i64::from(number % 100) * 3)),
        "preferred_channel": "WhatsApp",
        "contact_permission": "No",
        "notes": NOTE,
    });
    merge(base, lead)
}

pub fn rows(calendar: &Calendar) -> Vec<Value> {
    let leads = [
        json!({"client_id": "CL-S01", "person": "Omar Haddad", "lead_stage": "Negotiation",
            "buy_rent": "Buy", "preferred_communities": "Dubai Marina",
            "minimum_budget_aed": 2_200_000, "maximum_budget_aed": 2_600_000, "priority": "High",
            "lead_quality_score_100": 92, "finance_type": "Cash", "funds_confirmed": "Yes",
            "decision_maker": "Yes", "buying_moving_urgency": "Immediately",
            "purchase_rental_purpose": "End use", "relationship_status": "Active",
            "must_have_criteria": "Marina view, two parking spaces",
            "last_qualified_on": calendar.day(-2)}),
        json!({"client_id": "CL-S02", "person": "Mariam Al Suwaidi", "lead_stage": "Viewing",
            "buy_rent": "Rent", "preferred_communities": "JVC", "property_type": "Studio",
            "bedrooms": 0, "minimum_budget_aed": 40_000, "maximum_budget_aed": 60_000,
            "priority": "High", "lead_quality_score_100": 85, "lead_source": "Bayut",
            "finance_type": "Self-funded", "funds_confirmed": "Yes",
            "buying_moving_urgency": "Within 30 days", "target_date": calendar.day(25)}),
        json!({"client_id": "CL-S03", "person": "Daniel Okafor", "lead_stage": "Qualified",
            "buy_rent": "Buy", "preferred_communities": "Downtown Dubai",
            "minimum_budget_aed": 2_800_000, "maximum_budget_aed": 3_400_000,
            "lead_quality_score_100": 74, "lead_source": "Website", "finance_type": "Mortgage",
            "mortgage_stage": "Pre-approved", "funds_confirmed": "Partially",
            "buying_moving_urgency": "Within 60 days", "primary_objection": "Service charges"}),
        json!({"client_id": "CL-S04", "person": "Hannah Weber", "lead_stage": "New",
            "buy_rent": "Rent", "preferred_communities": "Business Bay",
            "minimum_budget_aed": 120_000, "maximum_budget_aed": 150_000, "priority": "Low",
            "lead_quality_score_100": 40, "lead_source": "Instagram",
            "buying_moving_urgency": "Exploring", "preferred_channel": "Email"}),
        json!({"client_id": "CL-S05", "person": "Arjun Kapoor", "lead_stage": "Contacted",
            "buy_rent": "Buy", "preferred_communities": "Al Reem Island", "emirate": "Abu Dhabi",
            "minimum_budget_aed": 1_400_000, "maximum_budget_aed": 1_800_000,
            "lead_quality_score_100": 61, "lead_source": "Referral", "client_type": "Investor",
            "finance_type": "Mortgage", "mortgage_stage": "In progress",
            "buying_moving_urgency": "Within 90 days", "purchase_rental_purpose": "Investment"}),
        json!({"client_id": "CL-S06", "person": "Sofia Rossi", "lead_stage": "Documentation",
            "buy_rent": "Rent", "preferred_communities": "Business Bay", "property_type": "Office",
            "bedrooms": 0, "minimum_budget_aed": 150_000, "maximum_budget_aed": 200_000,
            "priority": "High", "lead_quality_score_100": 88, "lead_source": "LinkedIn",
            "finance_type": "Self-funded", "funds_confirmed": "Yes", "decision_maker": "Joint",
            "buying_moving_urgency": "Immediately"}),
        json!({"client_id": "CL-S07", "person": "Khalid Al Nuaimi", "lead_stage": "Closed",
            "buy_rent": "Buy", "preferred_communities": "Palm Jumeirah", "bedrooms": 3,
            "minimum_budget_aed": 4_500_000, "maximum_budget_aed": 5_000_000,
            "lead_quality_score_100": 95, "lead_source": "Referral", "client_type": "Investor",
            "finance_type": "Cash", "funds_confirmed": "Yes",
            "relationship_status": "Past client"}),
        json!({"client_id": "CL-S08", "person": "Grace Liu", "lead_stage": "Lost",
            "buy_rent": "Buy", "preferred_communities": "Dubai Hills Estate",
            "minimum_budget_aed": 1_900_000, "maximum_budget_aed": 2_300_000, "priority": "Low",
            "lead_quality_score_100": 30, "lead_source": "Facebook", "finance_type": "Mortgage",
            "mortgage_stage": "Not started", "lost_reason": "Financing",
            "lost_on": calendar.day(-9), "recontact_possible": "Yes",
            "re_engage_date": calendar.day(60), "relationship_status": "Inactive"}),
        json!({"client_id": "CL-S09", "person": "Youssef Mansour", "lead_stage": "On hold",
            "buy_rent": "Rent", "preferred_communities": "Dubai Marina", "bedrooms": 1,
            "minimum_budget_aed": 80_000, "maximum_budget_aed": 100_000, "priority": "Low",
            "lead_quality_score_100": 48, "lead_source": "TikTok",
            "buying_moving_urgency": "Exploring", "preferred_channel": "Phone"}),
        json!({"client_id": "CL-S10", "person": "Chloe Martin", "lead_stage": "New",
            "buy_rent": "Buy", "preferred_communities": "JVC", "bedrooms": 1,
            "minimum_budget_aed": 700_000, "maximum_budget_aed": 950_000,
            "lead_quality_score_100": 55, "lead_source": "Referral", "client_type": "Investor",
            "referred_by_client_id": "CL-S07", "purchase_rental_purpose": "Investment",
            "buying_moving_urgency": "Within 90 days"}),
    ];
    leads
        .into_iter()
        .zip(301..)
        .map(|(lead, number)| client(calendar, number, lead))
        .collect()
}
