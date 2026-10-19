//! Participant-scoped access (docs/agreements-design.md §9): company membership
//! plus the named participant, never role alone. Foreign, malformed and hidden IDs
//! all return the same not-found response, so IDs cannot be probed.
use super::{
    model::{Party, State},
    rows::AgreementRow,
};
use crate::{
    auth::{protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::http::HeaderMap;
use uuid::Uuid;

/// The Super Admin sees no agreements until the metadata view (design §9) is built.
pub async fn ensure_reader(state: &AppState, session: &Session, workspace: &str) -> ApiResult<()> {
    workspaces::ensure_access(state, session, workspace).await?;
    match session.user.role.as_str() {
        "super-admin" => Err(ApiError::forbidden()),
        _ => Ok(()),
    }
}

pub async fn ensure_writer(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    workspace: &str,
) -> ApiResult<()> {
    ensure_reader(state, session, workspace).await?;
    protection::mutation(state, headers, &session.csrf_token)
}

/// An agreement ID from the path; anything else is treated as a missing agreement.
pub fn id(value: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(value).map_err(|_| ApiError::missing())
}

/// The caller's party in this workspace, if any.
pub fn party_of(row: &AgreementRow, member: Uuid, workspace: &str) -> Option<Party> {
    if workspace == row.workspace_id && member == row.sender_member_id {
        Some(Party::Sender)
    } else if workspace == row.recipient_workspace_id && member == row.recipient_member_id {
        Some(Party::Recipient)
    } else {
        None
    }
}

/// A draft belongs to the sending company until it is sent.
fn visible_to(row: &AgreementRow, workspace: &str) -> bool {
    workspace == row.workspace_id
        || (workspace == row.recipient_workspace_id && row.state() != State::Draft)
}

/// Participants read their own agreements; an Admin reads the company's. Other
/// staff, including team-wide readers, get not-found.
pub fn can_read(row: &AgreementRow, session: &Session, workspace: &str) -> bool {
    visible_to(row, workspace)
        && (party_of(row, session.user.id, workspace).is_some() || session.user.role == "admin")
}

/// The caller's party when they may act on this agreement at all; otherwise not-found.
/// Admins who are not a named participant cannot act for one.
pub fn acting_party(row: &AgreementRow, session: &Session, workspace: &str) -> ApiResult<Party> {
    if !visible_to(row, workspace) {
        return Err(ApiError::missing());
    }
    party_of(row, session.user.id, workspace).ok_or_else(ApiError::missing)
}

/// A command that belongs to one named participant. The caller is already a party,
/// so the other party gets not-found, as for any agreement they cannot act on.
pub fn require(actual: Party, needed: Party) -> ApiResult<()> {
    if actual == needed {
        Ok(())
    } else {
        Err(ApiError::missing())
    }
}
