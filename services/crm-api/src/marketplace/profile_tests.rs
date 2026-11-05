//! Profile and commitment validation tests (packet MK1b).
use super::{
    join::agreed,
    profile::{self, Input, Licence},
};

fn input(communities: &[&str], licence: Option<(&str, &str)>) -> Input {
    Input {
        emirates: vec!["dubai".into()],
        communities: communities.iter().map(|name| (*name).to_owned()).collect(),
        property_types: vec!["residential_sale".into()],
        experience_years: 5,
        licence: licence.map(|(number, authority)| Licence {
            number: number.into(),
            authority: authority.into(),
        }),
    }
}

#[test]
fn communities_are_plain_names_and_cannot_carry_contacts() {
    let valid = profile::validate(input(&["Dubai Marina", "JVC"], None)).expect("valid");
    assert_eq!(valid.communities[1].key, "jvc");
    assert!(profile::validate(input(&["050 123 4567"], None)).is_err());
    assert!(profile::validate(input(&["me@example.test"], None)).is_err());
    assert!(profile::validate(input(&["www.example.test"], None)).is_err());
    assert!(profile::validate(input(&["JVC/2"], None)).is_err());
    assert!(profile::validate(input(&["JVC", "jvc"], None)).is_err());
    let long = "a".repeat(61);
    assert!(profile::validate(input(&[&long], None)).is_err());
    assert_eq!(
        profile::validate(input(&["  Dubai   Marina  "], None))
            .expect("trimmed")
            .communities[0]
            .name,
        "Dubai   Marina"
    );
}

#[test]
fn a_licence_is_letters_and_digits_with_a_known_authority() {
    assert!(profile::validate(input(&[], Some(("123456", "RERA")))).is_ok());
    assert!(profile::validate(input(&[], Some(("123456", "Dubai")))).is_err());
    assert!(profile::validate(input(&[], Some(("AB-123", "RERA")))).is_err());
    assert!(profile::validate(input(&[], Some(("0501234567", "RERA")))).is_err());
    assert!(profile::validate(input(&[], Some(("123456789012345678901", "RERA")))).is_err());
}

#[test]
fn the_other_profile_limits_are_enforced() {
    let mut too_much = input(&[], None);
    too_much.experience_years = 61;
    assert!(profile::validate(too_much).is_err());
    let mut no_emirates = input(&[], None);
    no_emirates.emirates.clear();
    assert!(profile::validate(no_emirates).is_err());
    let mut wrong_type = input(&[], None);
    wrong_type.property_types = vec!["land".into()];
    assert!(profile::validate(wrong_type).is_err());
    assert!(profile::validate(input(&[], None)).is_ok());
}

#[test]
fn joining_needs_one_true_per_commitment_and_the_consent() {
    assert!(agreed(&[true, true, true, true], 4, true, 4));
    assert!(!agreed(&[true, true, true, false], 4, true, 3));
    assert!(!agreed(&[true, true, true, true], 4, false, 4));
    assert!(!agreed(&[true, true, true], 4, true, 3));
    assert!(!agreed(&[true, true, true, true, true], 4, true, 5));
}
