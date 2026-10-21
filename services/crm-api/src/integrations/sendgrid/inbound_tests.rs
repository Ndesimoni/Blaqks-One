//! Unit tests for `inbound.rs`: senders, threading headers, trust, spam and reports.
use super::*;

fn form(pairs: &[(&str, &str)]) -> Form {
    let mut form = Form::default();
    for (name, value) in pairs {
        form.fields
            .insert(name.to_string(), value.as_bytes().to_vec());
    }
    form
}

const ENVELOPE: (&str, &str) = (
    "envelope",
    r#"{"to":["Aidah@Keys.test","x@other.test"],"from":"bounce@gmail.com"}"#,
);

#[test]
fn a_reply_keeps_its_sender_thread_and_trust() {
    let headers = "Message-ID: <r1@gmail.com>\r\nIn-Reply-To: <m2@keys.test>\r\n\
        References: <m1@keys.test>\r\n <m2@keys.test>\r\nSubject: x";
    let mail = read(&form(&[
        ("from", "\"Client, A\" <Client@Gmail.com>"),
        ("subject", "Re: Villa"),
        ("text", "Yes please\r\n"),
        ("headers", headers),
        ("dkim", "{@gmail.com : pass}"),
        ("SPF", "pass"),
        ("spam_score", "0.4"),
        ENVELOPE,
    ]))
    .unwrap();
    assert_eq!(mail.from, "client@gmail.com");
    assert_eq!(mail.name.as_deref(), Some("Client, A"));
    assert_eq!(mail.text, "Yes please");
    assert_eq!(mail.message_id.as_deref(), Some("<r1@gmail.com>"));
    assert_eq!(mail.references, ["<m2@keys.test>", "<m1@keys.test>"]);
    assert_eq!(mail.recipients, ["aidah@keys.test", "x@other.test"]);
    assert!(mail.verified && !mail.spam && !mail.report);
}

#[test]
fn unsafe_senders_are_refused_and_html_spam_and_reports_are_marked() {
    for from in [
        "a@x.test, b@y.test",
        "Boss <a@x.test> <b@y.test>",
        "nobody",
        "",
    ] {
        assert!(read(&form(&[("from", from), ENVELOPE])).is_none(), "{from}");
    }
    assert!(
        read(&form(&[("from", "a@x.test")])).is_none(),
        "no envelope"
    );
    let mail = read(&form(&[
        ("from", "Mailer-Daemon@mx.test"),
        ("html", "<p>Hello <b>there</b></p><script>x()</script>"),
        (
            "headers",
            "Content-Type: multipart/report; report-type=delivery-status",
        ),
        ("dkim", "{@evil.test : pass}"),
        ("spam_score", "9.1"),
        ENVELOPE,
    ]))
    .unwrap();
    assert!(mail.text.contains("Hello") && !mail.text.contains('<'));
    assert!(mail.report && mail.spam && !mail.verified);
}
