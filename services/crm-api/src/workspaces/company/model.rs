use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Clone, Copy, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AccountType {
    Brokerage,
}

pub const FREE_MEMBER_LIMIT: i32 = 3;

impl AccountType {
    pub fn name(self) -> &'static str {
        "brokerage"
    }

    pub(super) fn member_limit(self) -> Option<i32> {
        Some(FREE_MEMBER_LIMIT)
    }
}

#[derive(Clone, Copy)]
pub enum Origin {
    Operator,
    Signup,
}

impl Origin {
    pub(super) fn name(self) -> &'static str {
        match self {
            Self::Operator => "operator",
            Self::Signup => "signup",
        }
    }
}

#[derive(Clone, Copy)]
pub struct NewCompany {
    pub account_type: AccountType,
    pub origin: Origin,
}

impl NewCompany {
    pub const OPERATOR_BROKERAGE: Self = Self {
        account_type: AccountType::Brokerage,
        origin: Origin::Operator,
    };
}

/// The sole public projection: operational origins and history never enter auth DTOs.
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Company {
    pub account_type: String,
    pub member_limit: Option<i32>,
    pub display_name: Option<String>,
    pub emirate: Option<String>,
    pub setup_complete: bool,
    pub version: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SeatLimitRequest {
    pub member_limit: i32,
    pub version: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeatUsage {
    pub used: i64,
    pub limit: i32,
    pub version: i64,
}
