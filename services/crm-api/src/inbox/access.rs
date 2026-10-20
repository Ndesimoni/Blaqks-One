//! Who sees which conversations (design §4 and §11). The Admin and whole-team staff see
//! the company's conversations; assigned-only staff see those they hold, plus Unassigned
//! ones on channels they may reply on, so they can claim them. The Super Admin sees none.
//! Foreign, hidden and malformed IDs all return the same not-found.
use crate::{
    auth::{profile::UserRow, protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::http::HeaderMap;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// The bound values of [`predicate`]: `caller` is NULL for team scope.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Viewer {
    pub id: Uuid,
    pub caller: Option<Uuid>,
    pub whatsapp: bool,
    pub email: bool,
    pub manager: bool,
}

impl Viewer {
    pub fn of(user: &UserRow) -> Self {
        let access = &user.channel_access.0;
        Self {
            id: user.id,
            caller: (!user.has_team_scope()).then_some(user.id),
            whatsapp: access.whatsapp,
            email: access.email,
            manager: user.role == "admin",
        }
    }
}

/// SQL condition that conversation `alias` is visible; bind [`Viewer`] fields to the
/// `caller`, `whatsapp` and `email` placeholders.
pub fn predicate(alias: &str, caller: &str, whatsapp: &str, email: &str) -> String {
    format!(
        "({caller}::uuid IS NULL OR {alias}.assignee_id={caller} \
         OR ({alias}.assignee_id IS NULL AND (({alias}.channel='whatsapp' AND {whatsapp}::bool) \
           OR ({alias}.channel='email' AND {email}::bool))))"
    )
}

/// Session-level check before any query: company members only, never the Super Admin.
pub async fn ensure_member(state: &AppState, session: &Session, workspace: &str) -> ApiResult<()> {
    workspaces::ensure_access(state, session, workspace).await?;
    if session.user.role == "super-admin" || session.user.workspace_id != workspace {
        return Err(ApiError::forbidden());
    }
    Ok(())
}

/// Company members who are the Admin (lead rules).
pub async fn ensure_admin(state: &AppState, session: &Session, workspace: &str) -> ApiResult<()> {
    ensure_member(state, session, workspace).await?;
    if session.user.role != "admin" {
        return Err(ApiError::forbidden());
    }
    Ok(())
}

/// The same check for a write, plus Origin and CSRF.
pub async fn ensure_writer(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    workspace: &str,
) -> ApiResult<()> {
    ensure_member(state, session, workspace).await?;
    protection::mutation(state, headers, &session.csrf_token)
}

/// Re-reads the live member inside the transaction (H4) and repeats the member rule.
pub async fn live(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
) -> ApiResult<UserRow> {
    let user = workspaces::member(transaction, workspace, actor).await?;
    if user.role == "super-admin" || user.workspace_id != workspace {
        return Err(ApiError::forbidden());
    }
    Ok(user)
}

pub fn id(value: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(value).map_err(|_| ApiError::missing())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_predicate_binds_scope_and_reply_grants() {
        let sql = predicate("c", "$2", "$3", "$4");
        assert!(sql.starts_with("($2::uuid IS NULL OR c.assignee_id=$2"));
        assert!(sql.contains("c.assignee_id IS NULL"));
        assert!(sql.contains("c.channel='whatsapp' AND $3::bool"));
        assert!(sql.contains("c.channel='email' AND $4::bool"));
        assert!(
            !sql.contains("facebook"),
            "social replies need the S1 grant"
        );
    }
}
