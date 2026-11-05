//! Who may use team chat (docs/team-chat.md). Live members of the company only; Blaqks One
//! reads no company chat. The Blaqks One organisation has its own team chat for the Owner
//! and platform staff (BO1f, docs/blaqks-one-console.md §11), which no company member reaches. Channels are open to every member; a direct conversation
//! only to its two members — not even the Admin (owner decision 2026-10-21). Foreign,
//! hidden and malformed IDs all return the same not-found.
use crate::{
    auth::{profile::UserRow, protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::http::HeaderMap;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

pub type Tx<'a> = Transaction<'a, Postgres>;

/// Session-level check before any query; writes also pass Origin and CSRF.
pub async fn ensure(
    state: &AppState,
    session: &Session,
    headers: Option<&HeaderMap>,
    workspace: &str,
) -> ApiResult<()> {
    if workspace == workspaces::ORGANISATION {
        if !is_platform(&session.user.role) || session.user.workspace_id != workspace {
            return Err(ApiError::forbidden());
        }
    } else {
        workspaces::ensure_access(state, session, workspace).await?;
        if is_platform(&session.user.role) || session.user.workspace_id != workspace {
            return Err(ApiError::forbidden());
        }
    }
    match headers {
        Some(headers) => protection::mutation(state, headers, &session.csrf_token),
        None => Ok(()),
    }
}

/// The live member, re-read inside the transaction (after the workspace lock for writes).
pub async fn live(tx: &mut Tx<'_>, workspace: &str, actor: Uuid) -> ApiResult<UserRow> {
    let user = workspaces::member(tx, workspace, actor).await?;
    let organisation = workspace == workspaces::ORGANISATION;
    if is_platform(&user.role) != organisation || user.workspace_id != workspace {
        return Err(ApiError::forbidden());
    }
    Ok(user)
}

/// The Blaqks One team: the Owner and platform staff, who chat only in the organisation.
fn is_platform(role: &str) -> bool {
    matches!(role, "super-admin" | "platform")
}

/// Who moderates channels and creates them: a company's Admin, and in the Blaqks One
/// organisation its Owner.
pub fn moderates(user: &UserRow) -> bool {
    matches!(user.role.as_str(), "admin" | "super-admin")
}

#[derive(Clone, Debug, FromRow)]
pub struct Room {
    pub id: Uuid,
    pub kind: String,
    pub name: Option<String>,
    pub created_by: Uuid,
}

/// SQL condition that room `r` is visible to member `$2` in workspace `$1`.
pub const VISIBLE: &str = "r.workspace_id=$1 AND (r.kind='channel' OR EXISTS ( \
    SELECT 1 FROM chat.crm_chat_participants p WHERE p.room_id=r.id AND p.member_id=$2))";

/// A room the member may read and post in, optionally locked; otherwise not-found.
pub async fn room(
    tx: &mut Tx<'_>,
    workspace: &str,
    member: Uuid,
    id: &str,
    lock: bool,
) -> ApiResult<Room> {
    let id = Uuid::parse_str(id).map_err(|_| ApiError::missing())?;
    let sql = format!(
        "SELECT r.id,r.kind,r.name,r.created_by FROM chat.crm_chat_rooms r \
         WHERE r.id=$3 AND {VISIBLE} {}",
        if lock { "FOR UPDATE OF r" } else { "" }
    );
    sqlx::query_as(&sql)
        .bind(workspace)
        .bind(member)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(ApiError::missing)
}
