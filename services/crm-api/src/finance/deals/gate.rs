//! Deal check order (finance-design §6.1, H1): steps 1–2 depend only on the caller and run
//! before the body; step 4 repeats them on the live row under the workspace lock.
use super::super::access::MANAGE_DENIED;
use crate::{
    auth::{
        finance_access::{FinanceAccess, FinanceScope},
        grants::Action,
        profile::UserRow,
        protection,
        session::Session,
    },
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::http::HeaderMap;
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const APPROVE_DENIED: &str = "Your access doesn't include approving finance records.";
pub const REASON: &str = "A reason of 1 to 500 characters is required.";
pub const VERSION: &str = "A positive record version is required.";
pub const STALE: &str = "This deal changed. Reload before saving.";

/// What a finance operation needs from the caller.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Need {
    Module,
    Create,
    Edit,
    Assign,
    Approve,
    Manage,
}

/// The finance module ("Access denied."), then the action or role with its own message.
pub fn check(access: &FinanceAccess, need: Need) -> ApiResult<()> {
    if access.scope == FinanceScope::None {
        return Err(ApiError::forbidden());
    }
    let (granted, denied) = match need {
        Need::Module => (true, ApiError::forbidden()),
        Need::Create => (access.create, Action::Create.denied()),
        Need::Edit => (access.edit, Action::Edit.denied()),
        Need::Assign => (access.assign, Action::Assign.denied()),
        Need::Approve => (access.approve, ApiError::denied(APPROVE_DENIED)),
        Need::Manage => (access.manage, ApiError::denied(MANAGE_DENIED)),
    };
    granted.then_some(()).ok_or(denied)
}

/// Steps 1–2 of a read: workspace access, then the caller's need.
pub async fn reader(
    state: &AppState,
    session: &Session,
    workspace: &str,
    need: Need,
) -> ApiResult<()> {
    workspaces::ensure_access(state, session, workspace).await?;
    check(&session.user.finance_access(), need)
}

/// Steps 1–2 of a write: workspace access, CSRF, then the caller's need.
pub async fn writer(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    workspace: &str,
    need: Need,
) -> ApiResult<()> {
    workspaces::ensure_access(state, session, workspace).await?;
    protection::mutation(state, headers, &session.csrf_token)?;
    check(&session.user.finance_access(), need)
}

/// Step 4: the workspace lock, the live profile (archived workspaces are read-only), then
/// the same need on it. The live row is the only source of scope and grants for the write.
pub async fn relock(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
    need: Need,
) -> ApiResult<UserRow> {
    workspaces::lock(transaction, workspace).await?;
    let live = workspaces::ensure_writable(transaction, workspace, actor, None, None).await?;
    check(&live.finance_access(), need)?;
    if need == Need::Manage && live.workspace_id != workspace {
        return Err(ApiError::denied(MANAGE_DENIED));
    }
    Ok(live)
}

/// The value bound to the finance predicate's caller: NULL for team finance.
pub fn caller(user: &UserRow) -> Option<Uuid> {
    (user.finance_access().scope != FinanceScope::Team).then_some(user.id)
}

/// A path ID; malformed IDs get the same 404 as unknown and hidden ones.
pub fn id(text: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(text).map_err(|_| ApiError::missing())
}

pub fn version(value: &Value) -> ApiResult<i64> {
    value
        .as_i64()
        .filter(|version| *version > 0)
        .ok_or(ApiError::invalid(VERSION))
}

/// A required reason, trimmed, 1–500 characters.
pub fn reason(value: &Value) -> ApiResult<String> {
    optional_reason(value)?.ok_or(ApiError::invalid(REASON))
}

/// `null` or a reason of 1–500 characters.
pub fn optional_reason(value: &Value) -> ApiResult<Option<String>> {
    match value {
        Value::Null => Ok(None),
        Value::String(text) => {
            let text = text.trim();
            let length = text.chars().count();
            ((1..=500).contains(&length))
                .then(|| Some(text.to_string()))
                .ok_or(ApiError::invalid(REASON))
        }
        _ => Err(ApiError::invalid(REASON)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn versions_and_reasons_are_strict() {
        assert_eq!(version(&json!(3)).unwrap(), 3);
        for bad in [json!(0), json!(-1), json!(1.5), json!("1"), json!(null)] {
            assert_eq!(version(&bad).unwrap_err().1, VERSION, "{bad}");
        }
        assert_eq!(reason(&json!("  Fix  ")).unwrap(), "Fix");
        assert_eq!(optional_reason(&json!(null)).unwrap(), None);
        for bad in [json!(""), json!("   "), json!("x".repeat(501)), json!(5)] {
            assert_eq!(optional_reason(&bad).unwrap_err().1, REASON, "{bad}");
        }
        assert!(reason(&json!(null)).is_err());
        assert_eq!(id("nope").unwrap_err().0.as_u16(), 404);
    }
}
