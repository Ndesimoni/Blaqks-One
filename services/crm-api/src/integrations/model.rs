//! Connection state and the redacted connection row for the registry; the channel and
//! provider vocabulary lives in `vocabulary.rs`.
use serde_json::{json, Value};
use uuid::Uuid;

pub use super::vocabulary::{Channel, Provider};

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum State {
    Connected,
    ReconnectRequired,
    Disconnected,
}

impl State {
    pub fn parse(value: &str) -> Self {
        match value {
            "connected" => Self::Connected,
            "reconnect_required" => Self::ReconnectRequired,
            _ => Self::Disconnected,
        }
    }

    /// What the Channels screen shows: healthy, needs attention, or off.
    pub fn health(self) -> &'static str {
        match self {
            Self::Connected => "healthy",
            Self::ReconnectRequired => "attention",
            Self::Disconnected => "off",
        }
    }
}

/// A stored connection without its sealed credential.
#[derive(Clone, sqlx::FromRow)]
pub struct ConnectionRow {
    pub id: Uuid,
    pub workspace_id: String,
    pub channel: String,
    pub provider: String,
    pub external_account_id: String,
    pub display_label: String,
    pub owner_member_id: Option<Uuid>,
    pub state: String,
    pub credential_key_version: Option<i32>,
    pub credential_updated_at: Option<String>,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
}

impl ConnectionRow {
    pub fn state(&self) -> State {
        State::parse(&self.state)
    }

    /// The only shape the browser sees; the account ID is masked and credentials never
    /// appear (docs/messaging-design.md §8).
    pub fn view(&self) -> Value {
        json!({
            "id": self.id,
            "channel": self.channel,
            "provider": self.provider,
            "label": self.display_label,
            "accountHint": super::wire::mask(&self.external_account_id),
            "ownerMemberId": self.owner_member_id,
            "state": self.state,
            "health": self.state().health(),
            "version": self.version,
            "credentialUpdatedAt": self.credential_updated_at,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        })
    }
}
