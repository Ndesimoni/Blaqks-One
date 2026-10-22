//! Agreement kinds, parties and states (docs/agreements-design.md §2–§4). Shares are
//! basis points; money stays in fils. Stored rows live in `rows.rs`.
use crate::error::{ApiError, ApiResult};

pub const INVALID: &str = "Provide valid agreement details.";
pub const STALE: &str = "This agreement changed. Reload before saving.";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Full,
    Referral,
    CoBroking,
}

impl Kind {
    pub fn parse(value: &str) -> ApiResult<Self> {
        Ok(match value {
            "handover_full" => Self::Full,
            "handover_referral" => Self::Referral,
            "co_broking" => Self::CoBroking,
            _ => return Err(ApiError::invalid(INVALID)),
        })
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Full => "handover_full",
            Self::Referral => "handover_referral",
            Self::CoBroking => "co_broking",
        }
    }

    /// Sender and recipient shares. A full handover carries no sender share; a referral
    /// keeps 0.01–99.99%, and the company limit in `limits.rs` narrows it further.
    pub fn shares(self, sender_bp: i64) -> ApiResult<(i64, i64)> {
        let valid = match self {
            Self::Full => sender_bp == 0,
            Self::Referral => (1..=9_999).contains(&sender_bp),
            Self::CoBroking => (1..=9_999).contains(&sender_bp),
        };
        if !valid {
            return Err(ApiError::invalid(INVALID));
        }
        Ok((sender_bp, 10_000 - sender_bp))
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Party {
    Sender,
    Recipient,
}

impl Party {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Sender => "sender",
            Self::Recipient => "recipient",
        }
    }

    pub fn other(self) -> Self {
        match self {
            Self::Sender => Self::Recipient,
            Self::Recipient => Self::Sender,
        }
    }
}

/// The states A2 can reach. `completed` and `cancelled` arrive with their routes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum State {
    Draft,
    Sent,
    Accepted,
    Closed,
}

impl State {
    pub fn parse(value: &str) -> Self {
        match value {
            "draft" => Self::Draft,
            "sent" => Self::Sent,
            "accepted" => Self::Accepted,
            _ => Self::Closed,
        }
    }
}

pub const UNKNOWN_EVIDENCE: &str = "This agreement's evidence could not be read.";

/// How an action's actor was verified (design §5, H2 amendment 8). An approval is an
/// Admin's decision or the chosen approver's; readers refuse any other stored value rather
/// than show evidence they do not understand.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Verification {
    Member,
    ContactVerified,
    AdminDecision,
    ApproverDecision,
}

impl Verification {
    pub fn parse(value: &str) -> ApiResult<Self> {
        Ok(match value {
            "member" => Self::Member,
            "contact_verified" => Self::ContactVerified,
            "admin_decision" => Self::AdminDecision,
            "approver_decision" => Self::ApproverDecision,
            _ => return Err(ApiError::conflict(UNKNOWN_EVIDENCE)),
        })
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Member => "member",
            Self::ContactVerified => "contact_verified",
            Self::AdminDecision => "admin_decision",
            Self::ApproverDecision => "approver_decision",
        }
    }
}
