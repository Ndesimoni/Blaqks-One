//! Listing-share evidence digests (docs/record-sharing.md R2). Each is SHA-256 over compact
//! JSON with sorted keys, so anyone holding the evidence file can recompute it:
//! - the snapshot digest covers the facts, each file's kind, name and SHA-256 (never its
//!   bytes or storage IDs), the location switch and the location fingerprint;
//! - the location fingerprint is SHA-256 over the salt and the three location values, one
//!   per line, so the sender can later prove which unit was introduced without showing it;
//! - the share digest, stored on acceptance, covers the share, the snapshot digest, both
//!   people and companies, when it was sent, its last day and the note.
use crate::agreements::terms::{digest_of, hex};
use rand::Rng;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use uuid::Uuid;

pub const SCHEME: i16 = 1;
const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/// One photo or floor plan as the digest sees it.
pub fn file_entry(kind: &str, name: &str, sha256: &str) -> Value {
    json!({"kind": kind, "name": name, "sha256": sha256})
}

pub fn snapshot(
    facts: &Map<String, Value>,
    files: &[Value],
    exact: bool,
    location: Option<&str>,
) -> String {
    digest_of(&json!({
        "scheme": SCHEME,
        "facts": facts,
        "files": files,
        "exactLocation": exact,
        "locationDigest": location,
    }))
}

/// What the sender reviewed: the facts, the exact location (sent or not), the files and the
/// switch. Only the sender's side ever sees it, so it needs no salt; a new random salt on
/// a listing's first snapshot leaves it unchanged.
pub fn review(
    facts: &Map<String, Value>,
    location: &Map<String, Value>,
    files: &[Value],
    exact: bool,
) -> String {
    digest_of(&json!({
        "scheme": SCHEME,
        "facts": facts,
        "location": location,
        "files": files,
        "exactLocation": exact,
    }))
}

/// The location fingerprint of `salt` and the unit reference, address and map link.
pub fn location(salt: &str, values: [&str; 3]) -> String {
    let text = format!("{salt}\n{}\n{}\n{}", values[0], values[1], values[2]);
    hex(Sha256::digest(text.as_bytes()))
}

pub struct ShareFacts<'a> {
    pub id: Uuid,
    pub snapshot: &'a str,
    pub sender: (&'a str, Uuid),
    pub recipient: (&'a str, Uuid),
    pub sent_at: &'a str,
    pub view_ends_at: &'a str,
    pub note: Option<&'a str>,
}

/// The digest an acceptance records.
pub fn share(facts: &ShareFacts) -> String {
    digest_of(&json!({
        "scheme": SCHEME,
        "shareId": facts.id,
        "snapshotDigest": facts.snapshot,
        "sender": {"workspaceId": facts.sender.0, "memberId": facts.sender.1},
        "recipient": {"workspaceId": facts.recipient.0, "memberId": facts.recipient.1},
        "sentAt": facts.sent_at,
        "viewEndsAt": facts.view_ends_at,
        "note": facts.note,
    }))
}

/// A new random location salt: 32 lowercase hex characters.
pub fn salt() -> String {
    Uuid::new_v4().simple().to_string()
}

/// A new reference label, `LS-` and eight capital letters or digits.
pub fn reference() -> String {
    let mut rng = rand::thread_rng();
    let tail: String = (0..8)
        .map(|_| char::from(ALPHABET[rng.gen_range(0..ALPHABET.len())]))
        .collect();
    format!("LS-{tail}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn digests_are_stable_and_bound_to_every_input() {
        let mut facts = Map::new();
        facts.insert("listingTitle".into(), json!("Marina view"));
        let files = [file_entry("photo", "Photo 1", &"a".repeat(64))];
        let one = snapshot(&facts, &files, false, Some(&"b".repeat(64)));
        assert_eq!(one, snapshot(&facts, &files, false, Some(&"b".repeat(64))));
        assert_ne!(one, snapshot(&facts, &files, true, None));
        assert_ne!(one, snapshot(&facts, &[], false, Some(&"b".repeat(64))));
        let salt = salt();
        let unit = location(&salt, ["U-9", "", ""]);
        assert_eq!(unit, location(&salt, ["U-9", "", ""]));
        assert_ne!(unit, location(&salt, ["U-8", "", ""]));
        assert_ne!(unit, location(&super::salt(), ["U-9", "", ""]));
        assert!(reference().starts_with("LS-") && reference().len() == 11);
    }
}
