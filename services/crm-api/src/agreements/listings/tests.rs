//! The response matrix (review amendment 6) and the free-text warning.
use super::{
    access::Viewer,
    review::looks_like_contact,
    store::ShareRow,
    view::{view, Companies},
};
use serde_json::json;
use uuid::Uuid;

fn row(status: &str) -> ShareRow {
    ShareRow {
        id: Uuid::new_v4(),
        workspace_id: "a".into(),
        source_record_id: Uuid::new_v4(),
        from_id: Uuid::new_v4(),
        recipient_workspace_id: "b".into(),
        to_id: Uuid::new_v4(),
        status: status.into(),
        end_reason: (status == "ended").then(|| "end_date".into()),
        note: None,
        decline_known: false,
        created_at: "2026-10-23T08:00:00.000Z".into(),
        offer_ends_at: "2026-11-06T08:00:00.000Z".into(),
        view_ends_at: "2026-11-22T19:59:59.000Z".into(),
        opened_at: None,
        decided_at: None,
        closed_at: None,
        accepted_digest: None,
        from_name: Some("Sender".into()),
        from_email: Some("sender@example.test".into()),
        from_phone: Some("+971500000000".into()),
        to_name: Some("Agent".into()),
        reference: "LS-ABCD1234".into(),
        facts: json!({"listingTitle": "Marina view", "community": "Dubai Marina",
            "description": "Sea views", "unitReference": "U-9"}),
        media: json!([{"kind": "photo", "name": "Photo 1", "file": Uuid::new_v4(),
            "thumb": null, "sha256": "a".repeat(64)}]),
        exact_location: true,
        snapshot_digest: "b".repeat(64),
        location_digest: None,
        location_salt: None,
        sender_live: true,
    }
}

const NAMES: Companies = Companies {
    from: None,
    to: None,
};

#[test]
fn the_agent_sees_twelve_facts_until_accepting_and_nothing_after_the_end() {
    let pending = view(&row("pending"), Viewer::Agent, &NAMES);
    assert_eq!(
        pending["listing"],
        json!({"listingTitle": "Marina view", "community": "Dubai Marina"})
    );
    assert_eq!(pending["photos"], json!([]));
    assert!(pending["from"]["phone"].is_null() && pending["recordId"].is_null());
    assert_eq!(pending["allowed"]["accept"], true);
    let accepted = view(&row("accepted"), Viewer::Agent, &NAMES);
    assert_eq!(accepted["listing"]["unitReference"], "U-9");
    assert_eq!(accepted["photos"].as_array().map(Vec::len), Some(1));
    assert_eq!(accepted["from"]["phone"], "+971500000000");
    let ended = view(&row("ended"), Viewer::Agent, &NAMES);
    assert!(ended["listing"].is_null() && ended["photos"] == json!([]));
    assert_eq!(ended["label"], "Marina view · Dubai Marina");
}

#[test]
fn the_receiving_admin_reads_the_introduction_record_only() {
    let accepted = view(&row("accepted"), Viewer::AgentAdmin, &NAMES);
    assert_eq!(accepted["listing"]["listingTitle"], "Marina view");
    assert!(accepted["listing"].get("description").is_none());
    assert_eq!(accepted["photos"], json!([]));
    assert!(accepted["from"]["email"].is_null());
    let allowed = accepted["allowed"].as_object().cloned().unwrap_or_default();
    assert!(allowed
        .iter()
        .all(|(name, value)| name == "evidence" || value == false));
    assert!(view(&row("stopped"), Viewer::AgentAdmin, &NAMES)["listing"].is_null());
}

#[test]
fn the_sender_side_keeps_everything_and_its_listing_id() {
    let row = row("ended");
    let sent = view(&row, Viewer::Sender, &NAMES);
    assert_eq!(sent["listing"]["description"], "Sea views");
    assert_eq!(sent["recordId"], json!(row.source_record_id));
    assert_eq!(sent["photos"].as_array().map(Vec::len), Some(1));
}

#[test]
fn an_introducer_keeps_the_record_but_never_the_listing() {
    let row = row("ended");
    let kept = view(&row, Viewer::Introducer, &NAMES);
    assert!(kept["listing"].is_null() && kept["recordId"].is_null());
    assert_eq!(kept["photos"], json!([]));
    assert_eq!([&kept["side"], &kept["viewer"]], ["sender", "introducer"]);
    assert_eq!(kept["label"], "Marina view · Dubai Marina");
}

#[test]
fn a_suspended_sender_pauses_the_share_for_the_other_company() {
    let mut row = row("pending");
    row.sender_live = false;
    for viewer in [Viewer::Agent, Viewer::AgentAdmin] {
        let paused = view(&row, viewer, &NAMES);
        assert_eq!(paused["paused"], true);
        assert!(paused["listing"].is_null() && paused["photos"] == json!([]));
        assert_eq!(paused["allowed"]["accept"], false);
    }
    row.status = "accepted".into();
    assert!(view(&row, Viewer::Agent, &NAMES)["from"]["phone"].is_null());
    assert_eq!(view(&row, Viewer::Sender, &NAMES)["paused"], false);
}

#[test]
fn contact_details_in_free_text_are_flagged() {
    assert!(looks_like_contact("Call the owner on 050 123 4567"));
    assert!(looks_like_contact("Email owner@example.test for keys"));
    assert!(looks_like_contact("Owner: 050/123/4567"));
    assert!(looks_like_contact("Owner: 050\u{a0}123\u{a0}4567"));
    assert!(!looks_like_contact(
        "Three bedrooms, AED 2,500,000, sea views"
    ));
    assert!(!looks_like_contact("Meet @ the lobby"));
}
