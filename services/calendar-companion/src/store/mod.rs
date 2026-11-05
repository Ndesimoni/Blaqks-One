mod event;
mod queue;
mod vault;

#[cfg(test)]
pub use event::Attendee;
pub use event::Event;
pub use queue::{queue_snapshot, Job};
pub use vault::Vault;

use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub fn now() -> i64 {
    chrono::Utc::now().timestamp()
}
pub fn random_id() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Store {
    pub sessions: BTreeMap<String, Session>,
}
#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Session {
    pub csrf: String,
    pub oauth: Option<OAuthState>,
    pub tokens: Option<Tokens>,
    pub calendar: Option<Calendar>,
    pub jobs: BTreeMap<String, Job>,
    pub connection_error: Option<String>,
    #[serde(default)]
    pub snapshot_revision: i64,
    #[serde(default)]
    pub ready: bool,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct OAuthState {
    pub state: String,
    pub verifier: String,
    pub expires: i64,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Tokens {
    pub access: String,
    pub refresh: String,
    pub expires: i64,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Calendar {
    pub id: String,
    pub summary: String,
}
