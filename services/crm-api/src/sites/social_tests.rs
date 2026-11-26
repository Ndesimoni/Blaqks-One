use super::*;
use serde_json::json;

#[test]
fn networks_accept_only_their_own_profile_hosts() {
    for (field, good) in [
        ("instagram", "https://instagram.com/keyswithsimoni"),
        ("instagram", "https://www.instagram.com/keys"),
        ("youtube", "https://youtu.be/abc"),
        ("x", "https://twitter.com/keys"),
        ("tiktok", "https://vm.tiktok.com/abc"),
        ("linkedin", "https://ae.linkedin.com/in/keys"),
    ] {
        assert!(link(field, good), "{good}");
    }
    for bad in [
        "http://instagram.com/keys",
        "https://instagram.com.evil.example/keys",
        "https://evilinstagram.com/keys",
        "https://l.instagram.com/keys",
        "https://user@instagram.com/keys",
        "https://instagram.com:8443/keys",
        "https://instagram.com./keys",
        "https://INSTAGRAM.com/keys",
        "https://instagram.com",
        "javascript:alert(1)",
        " https://instagram.com/keys",
        "https://instagram.com/a b",
        "https://instagram.com\\@evil.example/",
    ] {
        assert!(!link("instagram", bad), "{bad}");
    }
    assert!(!link("facebook", "https://instagram.com/keys"));
    assert!(!link("unknown", "https://instagram.com/keys"));
}

#[test]
fn redirect_pages_and_wrapped_addresses_are_refused() {
    for (field, bad) in [
        (
            "facebook",
            "https://facebook.com/l.php?u=https%3A%2F%2Fevil.example",
        ),
        ("facebook", "https://l.facebook.com/l.php?u=x"),
        (
            "youtube",
            "https://youtube.com/redirect?q=https://evil.example",
        ),
        ("linkedin", "https://linkedin.com/redir/redirect?url=x"),
        ("x", "https://x.com/i/redirect?url=x"),
        (
            "instagram",
            "https://instagram.com/k?next=https%253A%252F%252Fevil.example",
        ),
        (
            "instagram",
            "https://instagram.com/k?next=%2F%2Fevil.example",
        ),
    ] {
        assert!(!link(field, bad), "{bad}");
    }
    assert!(link("youtube", "https://www.youtube.com/watch?v=abc"));
}

#[test]
fn the_other_website_is_a_real_domain_never_an_address_shortener_or_lookalike() {
    assert!(link("website", "https://keyswithsimoni.ae/about"));
    for bad in [
        "https://127.0.0.1/",
        "https://[::1]/",
        "https://localhost/",
        "https://intranet/",
        "https://xn--nstagram-6xa.com/",
        "https://bit.ly/abc",
        "https://company.example/",
        "https://shop.internal/",
    ] {
        assert!(!link("website", bad), "{bad}");
    }
}

#[test]
fn a_social_object_has_known_fields_with_valid_links() {
    assert!(links(&json!({"instagram": "https://instagram.com/k"})));
    assert!(links(&json!({})));
    assert!(!links(&json!({"instagram": ""})));
    assert!(!links(&json!({"myspace": "https://myspace.com/k"})));
    assert!(!links(&json!(["https://instagram.com/k"])));
    assert!(!links(
        &json!({"instagram": {"url": "https://instagram.com/k"}})
    ));
}

#[test]
fn serving_drops_invalid_links_and_member_websites_on_the_general_site() {
    let stored = json!({
        "instagram": "https://instagram.com/k",
        "website": "https://keyswithsimoni.ae/",
        "tiktok": "https://bit.ly/old",
    });
    let company = public(Some(&stored), false).unwrap();
    assert_eq!(company.as_object().unwrap().len(), 2);
    let general = public(Some(&stored), true).unwrap();
    assert_eq!(general, json!({"instagram": "https://instagram.com/k"}));
    assert_eq!(public(Some(&json!({"tiktok": "nope"})), false), None);
    assert_eq!(public(None, false), None);
}
