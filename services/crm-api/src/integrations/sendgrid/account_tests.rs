//! Unit tests for `account.rs`: the scope allowlist and the domain proof.
use super::*;

fn owned(scopes: &[&str]) -> Vec<String> {
    scopes.iter().map(|scope| scope.to_string()).collect()
}

#[test]
fn only_a_restricted_key_with_send_and_domain_read_is_accepted() {
    assert!(scopes_ok(&owned(&["mail.send", "whitelabel.read"])).is_ok());
    let webhooks = [
        "mail.send",
        "whitelabel.read",
        "user.webhooks.parse.settings.create",
    ];
    assert!(scopes_ok(&owned(&webhooks)).is_ok());
    assert!(scopes_ok(&owned(&["mail.send", "whitelabel.read", "2fa_required"])).is_ok());
    assert_eq!(scopes_ok(&owned(&["mail.send"])), Err(MISSING));
    let broad = ["mail.send", "whitelabel.read", "api_keys.create"];
    assert_eq!(scopes_ok(&owned(&broad)), Err(TOO_BROAD));
    let edit = ["mail.send", "whitelabel.read", "whitelabel.delete"];
    assert_eq!(scopes_ok(&owned(&edit)), Err(TOO_BROAD));
    let repoint = [
        "mail.send",
        "whitelabel.read",
        "user.webhooks.parse.settings.update",
    ];
    assert_eq!(scopes_ok(&owned(&repoint)), Err(TOO_BROAD));
    let policy = [
        "mail.send",
        "whitelabel.read",
        "user.webhooks.security.policies.delete",
    ];
    assert_eq!(scopes_ok(&owned(&policy)), Err(TOO_BROAD));
    assert_eq!(scopes_ok(&owned(&["teammates.create"])), Err(TOO_BROAD));
}

#[test]
fn domains_are_normalised_and_must_be_listed_as_valid() {
    assert_eq!(
        domain(" KeysWithSimoni.com. ").unwrap(),
        "keyswithsimoni.com"
    );
    assert_eq!(
        domain("crm.keys-with-simoni.ae").unwrap(),
        "crm.keys-with-simoni.ae"
    );
    for bad in [
        "",
        "localhost",
        "a@b.com",
        "https://x.com",
        "-x.com",
        "10.0.0.1",
        "a..com",
    ] {
        assert!(domain(bad).is_err(), "{bad}");
    }
    let listed = vec![
        AuthenticatedDomain {
            domain: "Keys.test".into(),
            valid: true,
        },
        AuthenticatedDomain {
            domain: "pending.test".into(),
            valid: false,
        },
    ];
    assert!(proves(&listed, "keys.test"));
    assert!(!proves(&listed, "pending.test"));
    assert!(!proves(&listed, "other.test"));
}
