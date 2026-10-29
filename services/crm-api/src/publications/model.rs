use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

pub const COLUMNS:&str="id,workspace,record,profile,member,physical_key,destination,active,version,source_version,snapshot,photos,floor_plans,revision";
#[derive(Clone, Debug, FromRow)]
pub struct Publication {
    pub id: Uuid,
    pub workspace: String,
    pub record: Uuid,
    pub profile: Uuid,
    pub member: Uuid,
    pub physical_key: String,
    pub destination: String,
    pub active: bool,
    pub version: i64,
    pub source_version: i64,
    pub snapshot: Value,
    pub photos: Vec<Uuid>,
    pub floor_plans: Vec<Uuid>,
    pub revision: Uuid,
}
impl Publication {
    pub fn listing(&self) -> Value {
        self.snapshot["listing"].clone()
    }
    pub fn area(&self) -> Value {
        self.snapshot["area"].clone()
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PublishInput {
    pub record_id: Uuid,
    pub record_version: i64,
    pub agent_profile_id: Uuid,
    #[serde(default)]
    pub version: i64,
    pub destination: String,
    pub permit_reference: String,
    #[serde(default)]
    pub developer: String,
    pub market: Option<String>,
    pub photos: Vec<Uuid>,
    #[serde(default)]
    pub floor_plans: Vec<Uuid>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WithdrawInput {
    pub version: i64,
}
#[derive(Clone, Debug, Serialize)]
pub struct Recipient {
    pub workspace: String,
    pub owner: Uuid,
    pub agent: Option<Uuid>,
    pub publication: Uuid,
    pub profile: Uuid,
    pub revision: Uuid,
}
