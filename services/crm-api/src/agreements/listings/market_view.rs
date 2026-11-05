//! Marketplace offers never reveal exact location, media or contacts before MK4 release.
use super::{access::Viewer, store::ShareRow, view::Companies};
use serde_json::{json, Value};

pub fn basic(facts: &Value) -> Value {
    let mut kept = super::view::basic(facts);
    if let Some(map) = kept.as_object_mut() {
        map.remove("listingTitle");
        map.remove("building");
        map.retain(|_, value| {
            !value
                .as_str()
                .is_some_and(super::review::looks_like_contact)
        });
    }
    kept
}

pub fn view(row: &ShareRow, viewer: Viewer, companies: &Companies) -> Value {
    let listing = if viewer != Viewer::Introducer && row.open() && !row.paused() {
        basic(&row.facts)
    } else {
        Value::Null
    };
    json!({
        "id": row.id, "origin": "marketplace", "reference": row.reference,
        "label": row.reference, "side": if viewer == Viewer::Introducer { "sender" } else { "recipient" }, "viewer": match viewer {
            Viewer::Agent => "agent", Viewer::Introducer=>"introducer", _ => "agentAdmin"
        },
        "paused": row.paused(), "status": row.status, "endReason": row.end_reason,
        "from": {"id": row.from_id, "name": row.from_name, "company": companies.from,
            "phone": null, "email": null},
        "to": {"id": row.to_id, "name": row.to_name, "company": companies.to},
        "createdAt": row.created_at, "offerEndsAt": row.offer_ends_at,
        "viewEndsAt": row.view_ends_at, "note": null, "exactLocation": false,
        "listing": listing, "photos": [], "floorPlans": [], "recordId": null,
        "allowed": {"accept": false,"decline": false,"withdraw": false,"stop": false,
            "extend": false,"evidence": true,"coBroking": false}
    })
}
