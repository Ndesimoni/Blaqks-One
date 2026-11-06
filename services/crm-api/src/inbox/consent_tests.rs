use super::*;
use serde_json::json;

fn change(value: Value) -> ApiResult<Change> {
    parse(value.as_object().unwrap())
}

#[test]
fn each_change_has_exactly_its_own_fields() {
    for (source, expected) in [
        ("phone", "phone"),
        ("in_person", "in_person"),
        ("form", "form"),
    ] {
        let parsed = change(json!({"change": "agreed", "source": source})).unwrap();
        assert_eq!(parsed, Change::Agreed(expected));
    }
    assert_eq!(
        change(json!({"change": "stopped"})).unwrap(),
        Change::Stopped
    );
    assert_eq!(
        change(json!({"change": "restored", "reason": "  Client called back to opt in.  "}))
            .unwrap(),
        Change::Restored("Client called back to opt in.".into())
    );
    for refused in [
        json!({}),
        json!({"change": "agreed"}),
        json!({"change": "agreed", "source": "client_first"}),
        json!({"change": "agreed", "source": "admin_restored"}),
        json!({"change": "agreed", "source": "phone", "reason": "x"}),
        json!({"change": "stopped", "source": "phone"}),
        json!({"change": "restored"}),
        json!({"change": "deleted"}),
        json!({"state": "opt_in"}),
    ] {
        assert!(change(refused.clone()).is_err(), "{refused}");
    }
    for reason in [json!(""), json!("   "), json!("x".repeat(501)), json!(5)] {
        let refused = change(json!({"change": "restored", "reason": reason}));
        assert_eq!(refused.unwrap_err().1, REASON);
    }
}

#[test]
fn the_view_says_none_until_something_is_recorded() {
    assert_eq!(shown(None, true)["state"], "none");
    let found = Consent {
        state: "opt_out".into(),
        source: "recorded_stop".into(),
        at: "2026-11-06T10:00:00.000Z".into(),
        recorded_by: None,
    };
    // Without the right to see how it was recorded, only the state shows (review L2).
    assert_eq!(
        shown(Some(&found), false),
        json!({"state": "opt_out", "source": null, "at": null})
    );
    assert_eq!(
        shown(Some(&found), true),
        json!({"state": "opt_out", "source": "recorded_stop", "at": "2026-11-06T10:00:00.000Z"})
    );
}
