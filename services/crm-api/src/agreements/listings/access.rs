//! Listing-share routes answer one identical not-found to everyone outside a share (review
//! amendment 6): the Super Admin, another company's members and malformed IDs alike. Writes
//! also check Origin and CSRF and run on the live profile after the caller's own workspace
//! lock; no command ever locks the other company's workspace.
use crate::{
    auth::{profile::UserRow, protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::http::HeaderMap;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn reader(state: &AppState, session: &Session, workspace: &str) -> ApiResult<()> {
    if session.user.role == "super-admin" || session.user.workspace_id != workspace {
        return Err(ApiError::missing());
    }
    workspaces::ensure_access(state, session, workspace)
        .await
        .map_err(|_| ApiError::missing())
}

pub async fn writer(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    workspace: &str,
) -> ApiResult<()> {
    reader(state, session, workspace).await?;
    protection::mutation(state, headers, &session.csrf_token)
}

/// The caller's workspace lock, then their live profile (frozen workspaces refuse writes).
pub async fn live(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
) -> ApiResult<UserRow> {
    workspaces::lock(tx, workspace).await?;
    workspaces::ensure_writable(tx, workspace, actor, None, None).await
}

/// A share or record ID from the path or body; anything else is the shared not-found.
pub fn id(text: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(text).map_err(|_| ApiError::missing())
}

/// Who the caller is to one share. Everyone else gets not-found.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Viewer {
    /// The member who sent it, or the sending company's Admin.
    Sender,
    /// The member who sent it but no longer holds the listing (and is not the Admin): the
    /// introduction record and evidence, never the listing (R2a security review L7).
    Introducer,
    /// The named agent.
    Agent,
    /// The receiving company's Admin: the introduction record only.
    AgentAdmin,
}

pub struct Caller<'a> {
    pub id: Uuid,
    pub workspace: &'a str,
    pub admin: bool,
}

impl<'a> Caller<'a> {
    pub fn of(session: &Session, workspace: &'a str) -> Self {
        Caller {
            id: session.user.id,
            workspace,
            admin: session.user.role == "admin",
        }
    }
}

/// The caller's place in a share between `(from company, from)` and `(to company, to)`.
pub fn viewer(
    caller: &Caller,
    (from_ws, from): (&str, Uuid),
    (to_ws, to): (&str, Uuid),
) -> Option<Viewer> {
    if caller.workspace == from_ws && (caller.id == from || caller.admin) {
        Some(Viewer::Sender)
    } else if caller.workspace == to_ws && caller.id == to {
        Some(Viewer::Agent)
    } else if caller.workspace == to_ws && caller.admin {
        Some(Viewer::AgentAdmin)
    } else {
        None
    }
}
