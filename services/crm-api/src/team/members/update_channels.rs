//! Channel hooks of a member update (messaging design §3, review M1; WhatsApp design §4,
//! W-M1 and W-L6). A suspension ends every channel identity of the member; staff losing
//! the email grant lose their mailbox and address, and losing the WhatsApp grant their
//! number. The hook runs in the member's own company workspace: when the Super Admin edits
//! an Admin from the organisation workspace, the Admin's company workspace is locked next,
//! after the organisation's and before any member row, in the order of
//! `workspaces::lock_all`, so no other path can deadlock with it.
use super::{directory::MemberRow, update::UpdateRequest};
use crate::{error::ApiResult, integrations::Leaving, workspaces};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// What the change ends, given the member's current row and the requested `active`.
pub fn leaving(current: &MemberRow, request: &UpdateRequest, active: bool) -> Leaving {
    if current.active && !active {
        return Leaving::ALL;
    }
    // Admins hold every channel without a grant, so only staff lose one.
    let staff = current.user.role == "staff";
    let before = &current.user.channel_access.0;
    let after = request.channel_access.as_ref();
    Leaving {
        email: staff && before.email && !after.is_some_and(|access| access.email),
        whatsapp: staff && before.whatsapp && !after.is_some_and(|access| access.whatsapp),
    }
}

/// The member's own company workspace, locked when it is not `workspace` (the editor's,
/// already locked). Only the Super Admin managing Admins edits across workspaces.
pub async fn home(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    id: Uuid,
    manages_admin: bool,
) -> ApiResult<String> {
    if !manages_admin {
        return Ok(workspace.to_owned());
    }
    // The profile view names an Admin's company workspace (their own ID).
    let home: Option<String> = sqlx::query_scalar(
        "SELECT workspace_id FROM crm_member_profiles WHERE id=$1 AND role='admin' AND NOT archived",
    )
    .bind(id)
    .fetch_optional(&mut **transaction)
    .await?;
    match home {
        Some(home) if home != workspace => {
            workspaces::lock_all(transaction, &[workspace, &home]).await?;
            Ok(home)
        }
        _ => Ok(workspace.to_owned()),
    }
}
