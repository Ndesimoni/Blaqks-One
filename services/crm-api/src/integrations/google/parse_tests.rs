use super::*;

fn part(mime: &str, data: &str) -> Part {
    Part {
        mime: mime.into(),
        body: Some(Body {
            data: Some(URL_SAFE_NO_PAD.encode(data)),
            attachment: None,
        }),
        ..Part::default()
    }
}

#[test]
fn senders_are_split_and_lower_cased() {
    assert_eq!(
        sender("\"Layla A.\" <Layla@Example.TEST>"),
        (Some("Layla A.".into()), "layla@example.test".into())
    );
    assert_eq!(
        sender("plain@example.test"),
        (None, "plain@example.test".into())
    );
}

#[test]
fn only_permanent_delivery_reports_are_bounces() {
    assert!(is_report(Some(
        "multipart/report; report-type=delivery-status"
    )));
    assert!(!is_report(Some(
        "multipart/report; report-type=disposition-notification"
    )));
    assert!(!is_report(Some("text/plain")));
    let report = |status: &str| Part {
        mime: "multipart/report".into(),
        parts: vec![part("message/delivery-status", status)],
        ..Part::default()
    };
    assert!(permanent_failure(&report(
        "Reporting-MTA: x\nStatus: 5.1.1\n"
    )));
    assert!(!permanent_failure(&report("Status: 4.4.1\n")));
}

#[test]
fn plain_text_wins_and_attachments_are_noticed() {
    let mut mixed = Part {
        mime: "multipart/mixed".into(),
        parts: vec![
            Part {
                mime: "multipart/alternative".into(),
                parts: vec![
                    part("text/plain", "مرحبا\r\nYes, Saturday works."),
                    part("text/html", "<p>x</p>"),
                ],
                ..Part::default()
            },
            Part {
                mime: "application/pdf".into(),
                filename: "passport.pdf".into(),
                body: Some(Body {
                    data: None,
                    attachment: Some("a1".into()),
                }),
                ..Part::default()
            },
        ],
        ..Part::default()
    };
    assert_eq!(text(&mixed), ("مرحبا\nYes, Saturday works.".into(), true));
    mixed.parts.pop();
    assert!(!text(&mixed).1);
}

#[test]
fn html_becomes_text_without_markup_or_scripts() {
    let html = "<html><head><style>p{}</style></head><body><p>Hello &amp; welcome</p>\
        <script>alert(1)</script><div>Line two<br>three</div><img src=\"https://t.example/p.gif\">\
        </body></html>";
    let (body, _) = text(&part("text/html", html));
    assert_eq!(body, "Hello & welcome\nLine two\nthree");
    assert!(!body.contains('<') && !body.contains("alert"));
}

#[test]
fn control_characters_are_dropped_and_length_is_bounded() {
    let long = format!("a\u{0007}b{}", "x".repeat(MAX_TEXT + 10));
    let (body, _) = text(&part("text/plain", &long));
    assert!(body.starts_with("ab"));
    assert_eq!(body.chars().count(), MAX_TEXT);
}
