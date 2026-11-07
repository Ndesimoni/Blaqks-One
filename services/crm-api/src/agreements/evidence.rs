//! Revision evidence (docs/agreements-design.md §3). The stored terms name both
//! parties, and the digest also covers the agreement ID, revision number and parent,
//! so an accepted digest identifies exactly one revision of one agreement between
//! two named participants. Recomputing it from the stored row reproduces it. Scheme 2
//! (A3, stored as `digest_scheme`) also covers who wrote the terms: the sender, the
//! recipient or, on an in-company hand-over, the company Admin. Scheme 1 revisions
//! digest the same object without `scheme` and `author`.
use super::terms::{digest_of, BuiltTerms};
use serde_json::{json, Value};
use uuid::Uuid;

/// The two named participants, as frozen into every revision.
#[derive(Clone)]
pub struct Parties {
    pub sender_workspace: String,
    pub sender_member: Uuid,
    pub recipient_workspace: String,
    pub recipient_member: Uuid,
}

impl Parties {
    fn view(&self) -> Value {
        json!({
            "sender": { "workspaceId": self.sender_workspace, "memberId": self.sender_member },
            "recipient": {
                "workspaceId": self.recipient_workspace,
                "memberId": self.recipient_member,
            },
        })
    }
}

/// Where a revision sits: its agreement, number and the revision it answers.
pub struct Place {
    pub agreement: Uuid,
    pub number: i32,
    pub parent: Option<Uuid>,
}

pub struct Sealed {
    pub terms: Value,
    pub digest: String,
}

/// Adds the parties to the terms and digests them (scheme 2) with the revision's place
/// and author.
pub fn seal(built: &BuiltTerms, parties: &Parties, place: &Place, author: &str) -> Sealed {
    let mut terms = built.value.clone();
    terms["parties"] = parties.view();
    Sealed {
        digest: authored(&terms, place, author),
        terms,
    }
}

/// The scheme 2 digest of stored terms at `place`, written by `author`.
pub fn authored(terms: &Value, place: &Place, author: &str) -> String {
    digest_of(&json!({
        "scheme": 2,
        "agreementId": place.agreement,
        "revision": place.number,
        "parentId": place.parent,
        "author": author,
        "terms": terms,
    }))
}
