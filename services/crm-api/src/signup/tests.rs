use super::{
    bot::{self, BotCheck, LocalBypass, Outcome},
    code,
    model::StartRequest,
    validation,
};
use crate::config::SignupMode;

#[test]
fn codes_are_six_decimal_digits_and_bound_to_the_ticket() {
    for _ in 0..1_000 {
        let value = code::generate();
        assert!(code::valid(&value));
    }
    let first = code::digest("ticket-a", "012345");
    assert_ne!(first, code::digest("ticket-b", "012345"));
    assert!(code::matches("ticket-a", "012345", &first));
    assert!(!code::matches("ticket-a", "012346", &first));
}

#[test]
fn masking_keeps_only_the_first_character_and_domain() {
    assert_eq!(code::mask("synthetic@example.test"), "s•••@example.test");
}

#[test]
fn local_bot_bypass_cannot_be_enabled_by_a_request() {
    let local = LocalBypass::new(SignupMode::Local);
    assert_eq!(
        local.verify("local-development", "signup_start"),
        Outcome::Pass
    );
    assert_eq!(local.verify("bypass", "signup_start"), Outcome::Fail);
    let off = LocalBypass::new(SignupMode::Off);
    assert_eq!(
        off.verify("local-development", "signup_start"),
        Outcome::Fail
    );
    assert_eq!(
        bot::require(&off, "local-development", "signup_start")
            .unwrap_err()
            .2,
        "bot_check_failed"
    );
}

fn request(email: &str) -> StartRequest {
    StartRequest {
        name: "Synthetic Agent".into(),
        email: email.into(),
        phone: "+971501234567".into(),
        password: "Synth3tic!".into(),
        terms_version: crate::auth::consents::TERMS_VERSION.into(),
        privacy_version: crate::auth::consents::PRIVACY_VERSION.into(),
        language: "en".into(),
        bot_token: "local-development".into(),
    }
}

#[test]
fn validation_normalises_ascii_email_and_refuses_international_case_edges() {
    let prepared = validation::start(request(" Synthetic@Example.TEST ")).unwrap();
    assert_eq!(prepared.email, "synthetic@example.test");
    let Err(error) = validation::start(request("İ@example.test")) else {
        panic!("international email must be refused")
    };
    assert_eq!((error.0.as_u16(), error.2), (400, "invalid_email"));
}
