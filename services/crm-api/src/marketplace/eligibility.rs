//! Company eligibility (docs/broker-marketplace.md §15): the company exists for seven days,
//! genuinely uses the CRM, and only then may its Admin apply. Deals and agreements never
//! count. The platform sees these numbers only.
use crate::{error::ApiResult, records::market_activity, workspaces::company::Age};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};

pub const MIN_AGE_DAYS: i64 = 7;
pub const MIN_PROPERTIES: i64 = 5;
pub const MIN_CLIENTS: i64 = 5;
pub const MIN_CONTACTS: i64 = 3;
pub const MIN_FOLLOW_UPS: i64 = 3;
pub const MIN_VIEWINGS: i64 = 1;

/// The checklist the screen shows line by line, with each line's own tick.
#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Checklist {
    pub age_days: i64,
    pub properties: i64,
    pub clients: i64,
    pub contacts: i64,
    pub follow_ups: i64,
    pub viewings: i64,
    pub recent: bool,
    pub met: bool,
}

impl Checklist {
    pub fn of(age: &Age, counts: market_activity::Counts) -> Self {
        let met = age.age_days >= MIN_AGE_DAYS
            && counts.properties >= MIN_PROPERTIES
            && counts.clients >= MIN_CLIENTS
            && counts.contacts >= MIN_CONTACTS
            && counts.follow_ups >= MIN_FOLLOW_UPS
            && counts.viewings >= MIN_VIEWINGS
            && counts.recent;
        Self {
            age_days: age.age_days,
            properties: counts.properties,
            clients: counts.clients,
            contacts: counts.contacts,
            follow_ups: counts.follow_ups,
            viewings: counts.viewings,
            recent: counts.recent,
            met,
        }
    }
}

impl Checklist {
    /// What a member's screen reads: every line's tick, and the counts for the Admin only,
    /// so assigned-only staff never learn company-wide totals (MK1 code review L8).
    pub fn view(&self, admin: bool) -> Value {
        let mut value = serde_json::to_value(self).unwrap_or(Value::Null);
        value["lines"] = json!({
            "age": self.age_days >= MIN_AGE_DAYS,
            "properties": self.properties >= MIN_PROPERTIES,
            "clients": self.clients >= MIN_CLIENTS,
            "contacts": self.contacts >= MIN_CONTACTS,
            "followUps": self.follow_ups >= MIN_FOLLOW_UPS,
            "viewings": self.viewings >= MIN_VIEWINGS,
            "recent": self.recent,
        });
        if !admin {
            for key in [
                "ageDays",
                "properties",
                "clients",
                "contacts",
                "followUps",
                "viewings",
            ] {
                value[key] = Value::Null;
            }
        }
        value
    }
}

/// The counts at this moment, read from the company's own records.
pub async fn checklist(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
) -> ApiResult<Checklist> {
    let age = crate::workspaces::company::age(&mut **tx, workspace).await?;
    let counts = market_activity::counts(tx, workspace).await?;
    Ok(Checklist::of(&age, counts))
}
