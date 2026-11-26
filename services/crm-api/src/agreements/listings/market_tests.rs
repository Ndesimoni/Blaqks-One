use super::{row, NAMES};
use crate::agreements::listings::{access::Viewer, view::view};
use serde_json::json;

#[test]
fn marketplace_recipient_never_reads_exact_facts_media_contact_or_generic_actions() {
    let mut row = row("pending");
    row.origin = "marketplace".into();
    row.note = Some("PRIVATE-NOTE".into());
    row.facts["listingTitle"] = json!("PRIVATE-UNIT-TITLE");
    for viewer in [Viewer::Agent, Viewer::AgentAdmin] {
        let shown = view(&row, viewer, &NAMES);
        for secret in ["PRIVATE-UNIT-TITLE", "PRIVATE-NOTE", "U-9", "+971500000000"] {
            assert!(!shown.to_string().contains(secret));
        }
        assert_eq!(shown["photos"], json!([]));
        for action in [
            "accept",
            "decline",
            "withdraw",
            "stop",
            "extend",
            "coBroking",
        ] {
            assert_eq!(shown["allowed"][action], false);
        }
    }
}
#[test]
fn marketplace_former_holder_and_closed_or_paused_recipients_have_no_listing() {
    let mut row = row("pending");
    row.origin = "marketplace".into();
    assert!(view(&row, Viewer::Introducer, &NAMES)["listing"].is_null());
    row.sender_live = false;
    assert!(view(&row, Viewer::Agent, &NAMES)["listing"].is_null());
    row.sender_live = true;
    row.status = "declined".into();
    assert!(view(&row, Viewer::Agent, &NAMES)["listing"].is_null());
}
