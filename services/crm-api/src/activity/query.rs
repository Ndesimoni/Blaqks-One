//! Query parameters of `GET activity`, checked in the contract's order: permission
//! parameters first (403, from the caller alone), then syntax and ranges (400).
use super::{cursor, dates};
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use std::collections::BTreeMap;
use uuid::Uuid;

const KEYS: [&str; 8] = [
    "from",
    "to",
    "actor",
    "kind",
    "collection",
    "action",
    "cursor",
    "limit",
];
/// Every action either source records (migrations 0004–0012).
const ACTIONS: [&str; 15] = [
    "created",
    "updated",
    "deleted",
    "assigned",
    "earned",
    "revised",
    "unearned",
    "approved",
    "rejected",
    "voided",
    "invited",
    "activated",
    "suspended",
    "archived",
    "access_changed",
];
pub const INVALID: &str = "Check the activity filters and try again.";
pub const RANGE: &str = "Choose a date range of up to 366 days, ending on or after its start.";
pub const LIMIT: &str = "Choose between 1 and 100 activity entries.";
pub const CURSOR: &str = "This page of activity is no longer valid. Reload the first page.";

/// Raw values per key; empty values count as absent.
pub struct Params(BTreeMap<String, Vec<String>>);

#[derive(Debug, PartialEq)]
pub struct Filters {
    pub kind: Option<String>,
    pub actor: Option<Uuid>,
    pub collection: Option<String>,
    pub action: Option<String>,
    pub days: (i64, i64),
    pub cursor: Option<(i64, Uuid)>,
    pub limit: i64,
}

impl Params {
    pub fn parse(raw: Option<&str>) -> Self {
        let mut values: BTreeMap<String, Vec<String>> = BTreeMap::new();
        for (key, value) in url::form_urlencoded::parse(raw.unwrap_or("").as_bytes()) {
            let list = values.entry(key.into_owned()).or_default();
            if !value.is_empty() {
                list.push(value.into_owned());
            }
        }
        Self(values)
    }

    fn all(&self, key: &str) -> &[String] {
        self.0.get(key).map(Vec::as_slice).unwrap_or(&[])
    }

    /// Step 3: `kind=team` needs a manager, assigned-only staff may name only themselves
    /// as actor, and every collection must be granted (unknown names included).
    pub fn authorise(&self, user: &UserRow, granted: &[&str]) -> ApiResult<()> {
        let manager = matches!(user.role.as_str(), "admin" | "super-admin");
        let team = self.all("kind").iter().any(|kind| kind == "team");
        let foreign_actor = !user.has_team_scope()
            && self
                .all("actor")
                .iter()
                .any(|actor| Uuid::parse_str(actor).ok() != Some(user.id));
        let ungranted = self
            .all("collection")
            .iter()
            .any(|collection| !granted.contains(&collection.as_str()));
        if (team && !manager) || foreign_actor || ungranted {
            return Err(ApiError::forbidden());
        }
        Ok(())
    }

    /// Step 4: one value per known key, valid kinds, actors, actions, dates, limit and
    /// cursor. `today` is the current Dubai day number.
    pub fn validate(&self, today: i64) -> ApiResult<Filters> {
        let unknown = self.0.keys().any(|key| !KEYS.contains(&key.as_str()));
        if unknown || self.0.values().any(|list| list.len() > 1) {
            return Err(ApiError::invalid(INVALID));
        }
        let one = |key: &str| self.all(key).first().map(String::as_str);
        let kind = one("kind").map(str::to_owned);
        let action = one("action").map(str::to_owned);
        let actor = one("actor").map(Uuid::parse_str).transpose();
        let kind_ok = kind
            .as_deref()
            .is_none_or(|kind| ["record", "team"].contains(&kind));
        let action_ok = action
            .as_deref()
            .is_none_or(|action| ACTIONS.contains(&action));
        let Ok(actor) = actor else {
            return Err(ApiError::invalid(INVALID));
        };
        if !kind_ok || !action_ok {
            return Err(ApiError::invalid(INVALID));
        }
        let days = dates::range(one("from"), one("to"), today).ok_or(ApiError::invalid(RANGE))?;
        let limit = match one("limit") {
            None => 50,
            Some(value) if value.len() <= 3 && value.bytes().all(|b| b.is_ascii_digit()) => {
                value.parse::<i64>().unwrap_or(0)
            }
            Some(_) => 0,
        };
        if !(1..=100).contains(&limit) {
            return Err(ApiError::invalid(LIMIT));
        }
        let cursor = match one("cursor") {
            Some(value) => Some(cursor::decode(value).ok_or(ApiError::invalid(CURSOR))?),
            None => None,
        };
        Ok(Filters {
            kind,
            actor,
            collection: one("collection").map(str::to_owned),
            action,
            days,
            cursor,
            limit,
        })
    }
}

#[cfg(test)]
#[path = "query_tests.rs"]
mod tests;
