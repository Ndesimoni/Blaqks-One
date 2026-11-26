use super::*;

fn message<'a>(content: Content<'a>, callback: Option<String>) -> Send<'a> {
    Send {
        // A synthetic SID, assembled so secret scanners never mistake it for a real one.
        account: concat!("AC", "0123456789abcdef", "0123456789abcdef"),
        token: "0123456789abcdef0123456789abcdef",
        from: "+99950001001",
        to: "+99970000001",
        content,
        callback,
    }
}

#[test]
fn the_form_holds_only_the_allowlisted_fields() {
    let text = form(&message(Content::Text("Hello"), None));
    let names: Vec<&str> = text.iter().map(|(name, _)| *name).collect();
    assert_eq!(names, ["From", "To", "Body"]);
    assert_eq!(text[0].1, "whatsapp:+99950001001");
    assert_eq!(text[1].1, "whatsapp:+99970000001");
    let values = vec!["Sara \"S\"".to_string(), "Saturday".to_string()];
    let callback = "https://crm.example.test/status?m=x".to_string();
    let template = form(&message(
        Content::Template {
            sid: "HX0123456789abcdef0123456789abcdef",
            variables: &values,
        },
        Some(callback.clone()),
    ));
    let names: Vec<&str> = template.iter().map(|(name, _)| *name).collect();
    assert_eq!(
        names,
        [
            "From",
            "To",
            "ContentSid",
            "ContentVariables",
            "StatusCallback"
        ]
    );
    // The server builds the JSON, so a typed quote cannot change its shape.
    assert_eq!(template[3].1, r#"{"1":"Sara \"S\"","2":"Saturday"}"#);
    assert_eq!(template[4].1, callback);
    let none = form(&message(
        Content::Template {
            sid: "HX0123456789abcdef0123456789abcdef",
            variables: &[],
        },
        None,
    ));
    assert_eq!(none[3].1, "{}");
}

#[test]
fn only_answers_proving_no_acceptance_are_retried() {
    let reply = |sid: Option<&str>, code: Option<i64>| {
        Some(Reply {
            sid: sid.map(str::to_owned),
            code,
        })
    };
    let sid = format!("SM{}", "ab".repeat(16));
    assert_eq!(
        answer(201, None, reply(Some(&sid), None)),
        Answer::Accepted(Some(sid.clone()))
    );
    assert_eq!(
        answer(201, None, reply(Some("not-a-sid"), None)),
        Answer::Accepted(None)
    );
    assert_eq!(answer(201, None, None), Answer::Accepted(None));
    let wait = Some(Duration::from_secs(2));
    assert_eq!(answer(429, wait, None), Answer::RateLimited(wait));
    assert_eq!(answer(401, None, None), Answer::Refused);
    assert_eq!(
        answer(400, None, reply(None, Some(63016))),
        Answer::Rejected(Some(63016))
    );
    assert_eq!(answer(404, None, None), Answer::Rejected(None));
    for unclear in [500, 502, 503, 302, 100] {
        assert_eq!(answer(unclear, None, None), Answer::Unclear, "{unclear}");
    }
}
