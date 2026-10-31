//! Unit tests for `multipart.rs`: fields, files, limits and refusals.
use super::*;

fn form(parts: &[(&str, Option<&str>, &str)]) -> Vec<u8> {
    let mut body = String::new();
    for (name, file, value) in parts {
        body.push_str("--XyZ\r\nContent-Disposition: form-data; name=\"");
        body.push_str(name);
        body.push('"');
        if let Some(file) = file {
            body.push_str(&format!("; filename=\"{file}\""));
        }
        body.push_str("\r\n\r\n");
        body.push_str(value);
        body.push_str("\r\n");
    }
    body.push_str("--XyZ--\r\n");
    body.into_bytes()
}

#[test]
fn fields_are_read_and_files_kept_as_ranges() {
    let body = form(&[
        ("from", None, "Client <c@x.test>"),
        ("text", None, "Hello\r\nthere"),
        ("attachment1", Some("plan.pdf"), "%PDF"),
    ]);
    let parsed = parse(&body, "XyZ").unwrap();
    assert_eq!(parsed.fields["from"], b"Client <c@x.test>");
    assert_eq!(parsed.fields["text"], b"Hello\r\nthere");
    assert_eq!(parsed.files.len(), 1);
    assert_eq!(parsed.files[0].field, "attachment1");
    assert_eq!(&body[parsed.files[0].range.clone()], b"%PDF");
    assert!(!parsed.fields.contains_key("attachment1"));
}

#[test]
fn malformed_repeated_or_oversized_forms_are_refused() {
    assert!(parse(&form(&[("dkim", None, "a"), ("dkim", None, "b")]), "XyZ").is_none());
    assert!(parse(b"no boundary here", "XyZ").is_none());
    // A part without a name is skipped and counted, never the whole mail (review L2).
    let nameless = parse(
        b"--XyZ\r\nContent-Disposition: form-data\r\n\r\nx\r\n--XyZ--",
        "XyZ",
    )
    .unwrap();
    assert_eq!((nameless.fields.len(), nameless.unreadable), (0, 1));
    let many: Vec<(String, Option<&str>, &str)> =
        (0..65).map(|n| (format!("f{n}"), None, "v")).collect();
    let refs: Vec<(&str, Option<&str>, &str)> =
        many.iter().map(|(n, f, v)| (n.as_str(), *f, *v)).collect();
    assert!(parse(&form(&refs), "XyZ").is_none(), "more than 64 parts");
    let long = format!("--XyZ\r\nX: {}\r\n\r\nv\r\n--XyZ--", "a".repeat(9000));
    assert!(
        parse(long.as_bytes(), "XyZ").is_none(),
        "part headers over 8 KiB"
    );
}

#[test]
fn only_form_data_with_a_plain_boundary_is_accepted() {
    assert_eq!(
        boundary("multipart/form-data; boundary=XyZ").as_deref(),
        Some("XyZ")
    );
    assert_eq!(
        boundary("multipart/form-data; boundary=\"a b\"").as_deref(),
        None
    );
    assert!(boundary("application/json").is_none());
    assert!(boundary("multipart/form-data").is_none());
}
