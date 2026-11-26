//! Editing a payment or expense (finance-design §4): pending rows stay pending, rejected
//! rows are resubmitted, approved rows change only on the Admin path with a reason and
//! void rows never change. Every edit records the editor (§13 M-F6).
use super::{
    admin,
    deals::gate,
    entry::{EntryState, Kind, VOIDED},
    errors::LOCKED,
    events::{self, Action, Changes},
    wire,
};
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
    records::audit,
};
use serde_json::{Map, Value};
use sqlx::{Postgres, Transaction};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Edit {
    Pending,
    Resubmit,
    Approved,
}

impl Edit {
    /// Columns an edit sets besides the fields: a resubmission clears the decision.
    pub fn status_sql(self) -> &'static str {
        match self {
            Self::Resubmit => {
                ",status='pending',decided_by=NULL,decided_at=NULL,decision_reason=NULL"
            }
            _ => "",
        }
    }
}

/// `{<key>, version}` or `{<key>, version, reason}`: the entry object, version and reason.
pub fn envelope(
    body: Value,
    kind: Kind,
    message: &'static str,
) -> ApiResult<(Value, i64, Option<String>)> {
    let with_reason = matches!(&body, Value::Object(map) if map.contains_key("reason"));
    let keys = match with_reason {
        true => vec![kind.key(), "version", "reason"],
        false => vec![kind.key(), "version"],
    };
    let mut body: Map<String, Value> = wire::exact(body, &keys, message)?;
    let version = gate::version(&body["version"])?;
    let reason = match body.get("reason") {
        Some(reason) => gate::optional_reason(reason)?,
        None => None,
    };
    let entry = body.remove(kind.key()).unwrap_or(Value::Null);
    Ok((entry, version, reason))
}

/// Step 7 for edits; the Admin path is opened for approved rows.
pub async fn mode(
    tx: &mut Transaction<'_, Postgres>,
    state: &EntryState,
    live: &UserRow,
    reason: Option<&str>,
) -> ApiResult<Edit> {
    let manage = live.finance_access().manage;
    let edit = match state.status.as_str() {
        "pending" => Edit::Pending,
        "rejected" => Edit::Resubmit,
        _ if !manage => return Err(ApiError::denied(LOCKED)),
        "approved" if reason.is_some() => Edit::Approved,
        "approved" => return Err(ApiError::invalid(gate::REASON)),
        _ => return Err(ApiError::conflict(VOIDED)),
    };
    if edit == Edit::Approved {
        admin::admin_path(tx, live).await?;
    }
    Ok(edit)
}

#[allow(clippy::too_many_arguments)]
/// Writes the edit's history: `resubmitted` (with the status change) or `updated`.
pub async fn record(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    kind: Kind,
    state: &EntryState,
    edit: Edit,
    actor: &UserRow,
    changes: Changes,
    reason: Option<&str>,
) -> ApiResult<()> {
    let (action, changes) = match edit {
        Edit::Resubmit => (
            Action::Resubmitted,
            changes.pair("status", "rejected", "pending"),
        ),
        _ => (Action::Updated, changes),
    };
    let entity = kind.entity();
    let id = state.id;
    events::append(tx, workspace, entity, id, action, actor.id, changes, reason).await?;
    audit::append(tx, actor.id, workspace, "updated", kind.collection(), id).await
}
