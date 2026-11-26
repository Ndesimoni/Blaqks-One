//! The fixed query keys and record/team actions `GET activity` accepts.

pub const KEYS: [&str; 8] = [
    "from",
    "to",
    "actor",
    "kind",
    "collection",
    "action",
    "cursor",
    "limit",
];
/// Every action the record and team sources record (migrations 0004–0012); channel
/// actions come from `integrations::activity`.
pub const ACTIONS: [&str; 15] = [
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
