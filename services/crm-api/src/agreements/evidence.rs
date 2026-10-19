//! Revision evidence (docs/agreements-design.md §3). The stored terms name both
//! parties, and the digest also covers the agreement ID, revision number and parent,
//! so an accepted digest identifies exactly one revision of one agreement between
//! two named participants. Recomputing it from the stored row reproduces it.
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

/// Adds the parties to the terms and digests them with the revision's place.
pub fn seal(built: &BuiltTerms, parties: &Parties, place: &Place) -> Sealed {
    let mut terms = built.value.clone();
    terms["parties"] = parties.view();
    Sealed {
        digest: digest(&terms, place),
        terms,
    }
}

/// The evidence digest of stored terms at `place`.
pub fn digest(terms: &Value, place: &Place) -> String {
    digest_of(&json!({
        "agreementId": place.agreement,
        "revision": place.number,
        "parentId": place.parent,
        "terms": terms,
    }))
}
