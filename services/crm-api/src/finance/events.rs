//! Append-only financial history (`crm_finance_events`, finance-design §2.2). Entities
//! and actions are closed enums, never request strings. `changes` holds only
//! `{field: [before, after]}` for money, rates, dates, statuses and agents; free text
//! (notes, TRN, receipt links) is recorded as `"changed"`, never its contents.
use crate::error::ApiResult;
use serde_json::{Map, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Entity {
    Settings,
    Agreement,
    Deal,
    Payment,
    Expense,
}

impl Entity {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Settings => "settings",
            Self::Agreement => "agreement",
            Self::Deal => "deal",
            Self::Payment => "payment",
            Self::Expense => "expense",
        }
    }
}

/// The 0011 action list (plus `deleted`/`reopened` for future-dated agreements).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Action {
    Created,
    Updated,
    Submitted,
    Resubmitted,
    Approved,
    Rejected,
    Voided,
    Earned,
    Revised,
    Unearned,
    SplitChanged,
    Assigned,
    Closed,
    Deleted,
    Reopened,
}

impl Action {
    fn as_str(self) -> &'static str {
        match self {
            Self::Created => "created",
            Self::Updated => "updated",
            Self::Submitted => "submitted",
            Self::Resubmitted => "resubmitted",
            Self::Approved => "approved",
            Self::Rejected => "rejected",
            Self::Voided => "voided",
            Self::Earned => "earned",
            Self::Revised => "revised",
            Self::Unearned => "unearned",
            Self::SplitChanged => "split_changed",
            Self::Assigned => "assigned",
            Self::Closed => "closed",
            Self::Deleted => "deleted",
            Self::Reopened => "reopened",
        }
    }
}

/// Collects `{field: [before, after]}` pairs, skipping unchanged fields.
#[derive(Default)]
pub struct Changes(Map<String, Value>);

impl Changes {
    pub fn pair(mut self, field: &str, before: impl Into<Value>, after: impl Into<Value>) -> Self {
        let (before, after) = (before.into(), after.into());
        if before != after {
            self.0
                .insert(field.into(), Value::Array(vec![before, after]));
        }
        self
    }

    /// Free text: records only that it changed.
    pub fn text(mut self, field: &str, changed: bool) -> Self {
        if changed {
            self.0.insert(field.into(), Value::String("changed".into()));
        }
        self
    }

    /// A marker such as `selfDecided` (§13 M-F6): `{field: true}`.
    pub fn flag(mut self, field: &str, on: bool) -> Self {
        if on {
            self.0.insert(field.into(), Value::Bool(true));
        }
        self
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

/// Appends one event in the caller's transaction. `clock_timestamp()` keeps the order
/// of several events written by one transaction.
#[allow(clippy::too_many_arguments)]
pub async fn append(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    entity: Entity,
    entity_id: Uuid,
    action: Action,
    actor: Uuid,
    changes: Changes,
    reason: Option<&str>,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO crm_finance_events \
         (id,workspace_id,entity,entity_id,action,actor_id,changes,reason,created_at) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp())",
    )
    .bind(Uuid::new_v4())
    .bind(workspace)
    .bind(entity.as_str())
    .bind(entity_id)
    .bind(action.as_str())
    .bind(actor)
    .bind(sqlx::types::Json(Value::Object(changes.0)))
    .bind(reason)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}
