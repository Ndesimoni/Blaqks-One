//! Payments and expenses share one approval model (finance-design §4, §13 M-F4, M-F6):
//! pending → approved | rejected, rejected → pending on resubmission and approved → void
//! on the Admin path. `Kind` is a closed enum, so table names never come from a request,
//! and every read goes through one finance-predicate query (identical 404s).
use super::{
    events::Entity,
    ids::FinanceIds,
    visibility::{finance_predicate, FinanceTable},
};
use sqlx::FromRow;
use uuid::Uuid;

pub use super::entry_sql::{fetch, locked, select};

pub const STALE: &str = "This record changed. Reload before saving.";
pub const VOIDED: &str = "Voided records cannot be changed.";
pub const NOT_APPROVED: &str = "Only approved records can be voided.";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Payment,
    Expense,
}

impl Kind {
    pub fn entity(self) -> Entity {
        match self {
            Self::Payment => Entity::Payment,
            Self::Expense => Entity::Expense,
        }
    }

    /// The `crm_activity` collection.
    pub fn collection(self) -> &'static str {
        match self {
            Self::Payment => "Payments",
            Self::Expense => "Expenses",
        }
    }

    pub fn ids(self) -> FinanceIds {
        match self {
            Self::Payment => FinanceIds::Payments,
            Self::Expense => FinanceIds::Expenses,
        }
    }

    pub fn table(self) -> &'static str {
        match self {
            Self::Payment => "crm_payments",
            Self::Expense => "crm_expenses",
        }
    }

    /// The request and response key: `payment` or `expense`.
    pub fn key(self) -> &'static str {
        match self {
            Self::Payment => "payment",
            Self::Expense => "expense",
        }
    }

    /// Whether the acting user (`$2`) has a stake in row `x`: submitter, last editor,
    /// expense owner, or the payment deal's holder, second agent or commission agent.
    pub(super) fn party(self) -> &'static str {
        match self {
            Self::Payment => {
                "x.submitted_by=$2 OR x.last_edited_by=$2 OR EXISTS(SELECT 1 FROM crm_deals pd \
                 WHERE pd.workspace_id=x.workspace_id AND pd.legacy_id=x.deal_ref \
                 AND (pd.assignee_id=$2 OR pd.second_agent_id=$2 OR EXISTS(SELECT 1 \
                 FROM crm_deal_snapshots ps JOIN crm_deal_commission_lines pl \
                 ON pl.snapshot_id=ps.id WHERE ps.deal_id=pd.id AND ps.superseded_at IS NULL \
                 AND pl.agent_id=$2)))"
            }
            Self::Expense => "x.submitted_by=$2 OR x.last_edited_by=$2 OR x.incurred_by=$2",
        }
    }

    /// The `?agent=` filter (`$4`): payments on deals they hold, expenses they incurred.
    pub(super) fn agent(self) -> &'static str {
        match self {
            Self::Payment => {
                "x.deal_ref IN (SELECT a.legacy_id FROM crm_deals a WHERE a.workspace_id=$1 \
                 AND a.assignee_id=$4)"
            }
            Self::Expense => "x.incurred_by=$4",
        }
    }

    pub(super) fn predicate(self) -> String {
        let table = match self {
            Self::Payment => FinanceTable::Payments,
            Self::Expense => FinanceTable::Expenses,
        };
        finance_predicate(table, "x", "$1", "$3")
    }
}

/// The approval state shared by both tables, as seen by the acting user.
#[derive(Clone, Debug, FromRow)]
pub struct EntryState {
    pub id: Uuid,
    pub version: i64,
    pub legacy_id: String,
    pub status: String,
    pub amount_fils: i64,
    pub notes: Option<String>,
    pub submitted_by: Uuid,
    pub submitted_name: String,
    pub decided_by: Option<Uuid>,
    pub decided_name: Option<String>,
    pub decided_at: Option<String>,
    pub decision_reason: Option<String>,
    /// The acting user submitted, last edited, incurred or benefits from the row.
    pub actor_party: bool,
    /// §13 M-F6: the acting user edited or resubmitted it since its last submission.
    pub actor_edited: bool,
}
