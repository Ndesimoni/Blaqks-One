//! Stored agreement and revision rows with their wire views.
use super::{
    evidence::Parties,
    model::{Party, State},
};
use serde_json::{json, Value};
use uuid::Uuid;

/// One agreement with both participants joined for authorisation checks.
#[derive(Clone, sqlx::FromRow)]
pub struct AgreementRow {
    pub id: Uuid,
    pub workspace_id: String,
    pub recipient_workspace_id: String,
    pub kind: String,
    pub state: String,
    pub version: i64,
    pub current_revision_id: Option<Uuid>,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub expired: bool,
    pub sender_member_id: Uuid,
    pub recipient_member_id: Uuid,
}

impl AgreementRow {
    pub fn state(&self) -> State {
        State::parse(&self.state)
    }

    pub fn parties(&self) -> Parties {
        Parties {
            sender_workspace: self.workspace_id.clone(),
            sender_member: self.sender_member_id,
            recipient_workspace: self.recipient_workspace_id.clone(),
            recipient_member: self.recipient_member_id,
        }
    }

    /// The wire shape: terms stay out of list responses and come from the revision.
    pub fn view(&self) -> Value {
        json!({
            "id": self.id,
            "kind": self.kind,
            "state": self.state,
            "version": self.version,
            "senderWorkspaceId": self.workspace_id,
            "recipientWorkspaceId": self.recipient_workspace_id,
            "senderMemberId": self.sender_member_id,
            "recipientMemberId": self.recipient_member_id,
            "expiresAt": self.expires_at,
            "expired": self.expired,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        })
    }
}

#[derive(Clone, sqlx::FromRow)]
pub struct RevisionRow {
    pub id: Uuid,
    pub number: i32,
    pub author_party: String,
    pub digest: String,
    pub terms: Value,
}

impl RevisionRow {
    pub fn author(&self) -> Party {
        match self.author_party.as_str() {
            "recipient" => Party::Recipient,
            _ => Party::Sender,
        }
    }

    pub fn view(&self) -> Value {
        json!({
            "id": self.id,
            "number": self.number,
            "authorParty": self.author().as_str(),
            "digest": self.digest,
            "terms": self.terms,
        })
    }
}
