//! What each person reads of a listing share (review amendment 6, the response matrix):
//! - the sender and the sending company's Admin: the whole snapshot, its photos, the
//!   sender's own listing ID and every action, at any time;
//! - the agent: the twelve basic facts while pending; the whole snapshot, photos and the
//!   sender's work phone and email while accepted and open; no listing facts once closed;
//! - the receiving company's Admin: the twelve facts while open, none once closed, never
//!   photos and never an action;
//! - the member who sent it but no longer holds the listing (review L7): no listing facts;
//! - while the sender or their company is suspended (review L6), the other company reads
//!   no listing facts and cannot answer: the share is `paused`.
//!
//! Everyone sees the reference, the label, the people, the dates and the status.
use super::{access::Viewer, store::ShareRow};
use crate::records::{listing_fields::BASIC, outside_facts::shown};
use serde_json::{json, Map, Value};

/// Display names of the two companies (`None` until a company sets one up).
pub struct Companies {
    pub from: Option<String>,
    pub to: Option<String>,
}

pub fn basic(facts: &Value) -> Value {
    let keys: Vec<&str> = BASIC.iter().filter_map(|stored| shown(stored)).collect();
    let all = facts.as_object().cloned().unwrap_or_default();
    let kept: Map<String, Value> = all
        .into_iter()
        .filter(|(key, _)| keys.contains(&key.as_str()))
        .collect();
    Value::Object(kept)
}

/// The listing title and community, frozen in the snapshot.
pub fn label(row: &ShareRow) -> String {
    let text = |key: &str| {
        row.facts
            .get(key)
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_owned()
    };
    let parts: Vec<String> = [text("listingTitle"), text("community")]
        .into_iter()
        .filter(|part| !part.is_empty())
        .collect();
    if parts.is_empty() {
        row.reference.clone()
    } else {
        parts.join(" · ")
    }
}

fn media(row: &ShareRow, kind: &str) -> Vec<Value> {
    let entries = row.media.as_array().cloned().unwrap_or_default();
    entries
        .into_iter()
        .filter(|entry| entry["kind"] == kind && !entry["file"].is_null())
        .map(|entry| json!({"name": entry["name"], "file": entry["file"], "thumb": entry["thumb"]}))
        .collect()
}

pub fn view(row: &ShareRow, viewer: Viewer, companies: &Companies) -> Value {
    let sender = viewer == Viewer::Sender;
    let sending_side = sender || viewer == Viewer::Introducer;
    let paused = row.paused() && !sending_side;
    let open_to_agent = viewer == Viewer::Agent && row.shown_to_agent();
    let listing = match viewer {
        Viewer::Sender => row.facts.clone(),
        Viewer::Agent if row.shown_to_agent() => row.facts.clone(),
        Viewer::Agent | Viewer::AgentAdmin if row.open() && !paused => basic(&row.facts),
        _ => Value::Null,
    };
    let photos = sender || open_to_agent;
    let contact = sender || open_to_agent;
    let pending = row.status == "pending";
    json!({
        "id": row.id,
        "reference": row.reference,
        "label": label(row),
        "side": if sending_side { "sender" } else { "recipient" },
        "viewer": match viewer { Viewer::Sender => "sender", Viewer::Introducer => "introducer",
            Viewer::Agent => "agent", Viewer::AgentAdmin => "agentAdmin" },
        "paused": paused,
        "from": {
            "id": row.from_id, "name": row.from_name, "company": companies.from,
            "phone": if contact { row.from_phone.clone() } else { None },
            "email": if contact { row.from_email.clone() } else { None },
        },
        "to": {"id": row.to_id, "name": row.to_name, "company": companies.to},
        "status": row.status,
        "endReason": row.end_reason,
        "createdAt": row.created_at,
        "offerEndsAt": if pending { Some(&row.offer_ends_at) } else { None },
        "viewEndsAt": row.view_ends_at,
        "decidedAt": row.decided_at,
        "openedAt": row.opened_at,
        "closedAt": row.closed_at,
        "note": row.note,
        "declinedAsKnown": row.decline_known,
        "exactLocation": row.exact_location,
        "listing": listing,
        "photos": if photos { media(row, "photo") } else { Vec::new() },
        "floorPlans": if photos { media(row, "floorPlan") } else { Vec::new() },
        "recordId": if sender { Some(row.source_record_id) } else { None },
        "allowed": {
            "accept": viewer == Viewer::Agent && pending && !paused,
            "decline": viewer == Viewer::Agent && pending && !paused,
            "withdraw": sender && pending,
            "stop": sender && row.status == "accepted",
            "extend": sender && row.status == "accepted",
            "evidence": true,
        },
    })
}
