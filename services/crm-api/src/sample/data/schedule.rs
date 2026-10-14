//! Sample follow-ups (due today, upcoming, overdue and done) and viewings.
use super::Calendar;
use serde_json::{json, Value};

pub fn follow_ups(calendar: &Calendar) -> Vec<Value> {
    let day = |offset| calendar.day(offset);
    vec![
        json!({"activity_id": "FU-S01", "client_id": "CL-S01", "property_id": "PR-S01",
            "contact_date": day(-1), "channel": "WhatsApp",
            "outcome_notes": "Sample: counter-offer discussed with the seller",
            "next_action": "Confirm the final price in writing", "due_date": day(0),
            "task_status": "Open"}),
        json!({"activity_id": "FU-S02", "client_id": "CL-S02", "property_id": "PR-S03",
            "contact_date": day(-2), "channel": "Phone",
            "outcome_notes": "Sample: wants a studio close to the park",
            "next_action": "Send the viewing location pin", "due_date": day(1),
            "task_status": "Open"}),
        json!({"activity_id": "FU-S03", "client_id": "CL-S03", "property_id": "PR-S05",
            "contact_date": day(-6), "channel": "Email",
            "outcome_notes": "Sample: asked for service charge history",
            "next_action": "Share the service charge statement", "due_date": day(-2),
            "task_status": "Open"}),
        json!({"activity_id": "FU-S04", "client_id": "CL-S06", "property_id": "PR-S08",
            "contact_date": day(-1), "channel": "Phone",
            "outcome_notes": "Sample: company documents received",
            "next_action": "Prepare the tenancy contract draft", "due_date": day(2),
            "task_status": "In progress"}),
        json!({"activity_id": "FU-S05", "client_id": "CL-S08", "contact_date": day(-9),
            "channel": "Email", "outcome_notes": "Sample: mortgage declined, paused search",
            "next_action": "Log the lost reason", "due_date": day(-9),
            "task_status": "Completed"}),
        json!({"activity_id": "FU-S06", "client_id": "CL-S05", "property_id": "PR-S09",
            "contact_date": day(-3), "channel": "WhatsApp",
            "outcome_notes": "Sample: comparing Al Reem towers",
            "next_action": "Send rental yield comparison", "due_date": day(3),
            "task_status": "Open"}),
    ]
}

pub fn viewings(calendar: &Calendar) -> Vec<Value> {
    vec![
        json!({"viewing_id": "VW-S01", "client_id": "CL-S01", "property_id": "PR-S01",
            "appointment_date_time": calendar.at(-3, "17:00"), "viewing_status": "Completed",
            "client_feedback": "Sample: loves the view, asked about parking",
            "next_action": "Submit the offer"}),
        json!({"viewing_id": "VW-S02", "client_id": "CL-S02", "property_id": "PR-S03",
            "appointment_date_time": calendar.at(1, "11:30"), "viewing_status": "Confirmed",
            "next_action": "Confirm access with the building manager"}),
        json!({"viewing_id": "VW-S03", "client_id": "CL-S03", "property_id": "PR-S05",
            "appointment_date_time": calendar.at(4, "16:00"), "viewing_status": "Scheduled",
            "next_action": "Confirm with the landlord"}),
        json!({"viewing_id": "VW-S04", "client_id": "CL-S09", "property_id": "PR-S02",
            "appointment_date_time": calendar.at(-1, "18:30"), "viewing_status": "Cancelled",
            "client_feedback": "Sample: postponed the move", "next_action": "Check in next month"}),
    ]
}
