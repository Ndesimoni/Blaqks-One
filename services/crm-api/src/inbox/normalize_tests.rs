use super::*;

#[test]
fn every_common_uae_phone_form_becomes_the_same_digits() {
    for typed in [
        "+971 50 000 0001",
        "+971-50-000-0001",
        "00971 50 000 0001",
        "050 000 0001",
        "(050) 000-0001",
        "500000001",
        "whatsapp:+971500000001",
    ] {
        assert_eq!(phone(typed).as_deref(), Some("971500000001"), "{typed}");
    }
    assert_eq!(phone("+44 20 7946 0000").as_deref(), Some("442079460000"));
}

#[test]
fn invalid_phones_never_match() {
    for bad in [
        "",
        "abc",
        "+971 50 x",
        "12345",
        "+1234567890123456",
        "+971+50",
        "١٢٣",
    ] {
        assert!(phone(bad).is_none(), "{bad}");
    }
}

#[test]
fn emails_are_lower_case_and_plus_tags_stay_significant() {
    assert_eq!(
        email(" Client@Example.TEST ").as_deref(),
        Some("client@example.test")
    );
    assert_eq!(
        email("a+tag@example.test").as_deref(),
        Some("a+tag@example.test")
    );
    for bad in [
        "",
        "no-at",
        "@example.test",
        "a@",
        "a@nodot",
        "a@.test",
        "a b@x.test",
    ] {
        assert!(email(bad).is_none(), "{bad}");
    }
}

#[test]
fn each_channel_builds_its_own_key() {
    let whatsapp = contact("whatsapp", "050 000 0001").unwrap();
    assert_eq!(whatsapp.key, "+971500000001");
    assert_eq!(whatsapp.phone_digits.as_deref(), Some("971500000001"));
    let mail = contact("email", "Lead@Example.test").unwrap();
    assert_eq!(
        (mail.key.as_str(), mail.email.as_deref()),
        ("lead@example.test", Some("lead@example.test"))
    );
    let tiktok = contact("tiktok", "user_123").unwrap();
    assert_eq!(tiktok.key, "tiktok:user_123");
    assert!(tiktok.phone_digits.is_none() && tiktok.email.is_none());
    assert!(contact("instagram", "bad id").is_none());
    assert!(contact("sms", "+971500000001").is_none());
}
