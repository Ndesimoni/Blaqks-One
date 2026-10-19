//! Evidence digests bind terms to the agreement, revision and both parties.
use super::{
    evidence::{self, Parties, Place},
    model::Kind,
    terms,
    tests::{input, now},
};
use serde_json::Value;
use uuid::Uuid;

fn parties(recipient: Uuid) -> Parties {
    Parties {
        sender_workspace: "ws-a".into(),
        sender_member: Uuid::from_u128(1),
        recipient_workspace: "ws-b".into(),
        recipient_member: recipient,
    }
}

fn place(agreement: u128, number: i32) -> Place {
    Place {
        agreement: Uuid::from_u128(agreement),
        number,
        parent: None,
    }
}

#[test]
fn evidence_digest_binds_parties_agreement_and_revision() {
    let built = terms::build(Kind::Full, &input(0, Value::Null), now()).expect("valid");
    let sealed = evidence::seal(&built, &parties(Uuid::from_u128(2)), &place(9, 1));
    assert_eq!(sealed.digest.len(), 64);
    assert_eq!(sealed.terms["parties"]["recipient"]["workspaceId"], "ws-b");
    assert_eq!(sealed.digest, evidence::digest(&sealed.terms, &place(9, 1)));
    let other = evidence::seal(&built, &parties(Uuid::from_u128(3)), &place(9, 1));
    assert_ne!(sealed.digest, other.digest);
    let moved = evidence::seal(&built, &parties(Uuid::from_u128(2)), &place(8, 1));
    assert_ne!(sealed.digest, moved.digest);
    let later = evidence::seal(&built, &parties(Uuid::from_u128(2)), &place(9, 2));
    assert_ne!(sealed.digest, later.digest);
}

#[test]
fn stored_terms_round_trip_to_the_same_digest() {
    let built = terms::build(Kind::Full, &input(0, Value::Null), now()).expect("valid");
    let sealed = evidence::seal(&built, &parties(Uuid::from_u128(2)), &place(9, 1));
    let stored: Value = serde_json::from_str(&sealed.terms.to_string()).expect("json");
    assert_eq!(evidence::digest(&stored, &place(9, 1)), sealed.digest);
}
