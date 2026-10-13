//! Which assignee an assigned-only caller may choose (contract §5, §6).
use crate::{
    auth::{
        grants::{Action, ASSIGN_DENIED},
        profile::UserRow,
    },
    error::{ApiError, ApiResult},
    records::{target::Target, visibility::RecordScope},
};
use uuid::Uuid;

pub const QUEUE_DENIED: &str = "Only your Admin can move records to the queue.";
pub const CHAIN_DENIED: &str = "Only the client's holder, the Admin or a full-team member can \
pass this follow-up on. You can return it to the client's holder.";

/// Step 3 for Clients, Properties and Contacts, where `null` is always the Admin queue.
/// Follow-ups are decided by [`ensure_target`] after the visibility-filtered fetch,
/// because there `null` may instead return the follow-up to its client's holder.
pub fn ensure_queue(scope: RecordScope, collection: &str, to: Option<Uuid>) -> ApiResult<()> {
    if collection != "Follow-ups" && to.is_none() && !scope.is_team() {
        return Err(ApiError::denied(QUEUE_DENIED));
    }
    Ok(())
}

/// Step 7, after `ensure_holder`. An assigned-only direct assignee of a client-linked
/// Follow-up who does not hold that client may only return it (`null`), so the
/// client's contact details never travel further down a hand-on chain. Elsewhere
/// `null` remains the Admin queue, which stays team-only.
pub fn ensure_target(
    scope: RecordScope,
    collection: &str,
    target: &Target,
    to: Option<Uuid>,
) -> ApiResult<()> {
    if scope.is_team() {
        return Ok(());
    }
    let return_only =
        collection == "Follow-ups" && target.client_ref.is_some() && !target.holds_client;
    match (return_only, to) {
        (true, None) | (false, Some(_)) => Ok(()),
        (true, Some(_)) => Err(ApiError::denied(CHAIN_DENIED)),
        (false, None) => Err(ApiError::denied(QUEUE_DENIED)),
    }
}

/// M-A, steps 2 and 4: handing on needs the Assign grant. Only a Follow-up that may
/// be returned (`may_return`: the target is unknown yet or `null`) waits for step 7.
pub fn ensure_assign_grant(user: &UserRow, collection: &str, may_return: bool) -> ApiResult<()> {
    if user.can(collection, Action::Assign) || (collection == "Follow-ups" && may_return) {
        return Ok(());
    }
    Err(Action::Assign.denied())
}

/// M-A, step 7 on the live row, for a caller without Assign: the only permitted move
/// is an assigned-only direct assignee returning a client-linked Follow-up whose
/// client they do not hold.
pub fn ensure_return(scope: RecordScope, target: &Target, to: Option<Uuid>) -> ApiResult<()> {
    let returning = matches!(scope, RecordScope::Assigned(caller)
        if target.assignee_id == Some(caller)
            && target.client_ref.is_some()
            && !target.holds_client
            && to.is_none());
    if !returning {
        return Err(ApiError::denied(ASSIGN_DENIED));
    }
    Ok(())
}

#[cfg(test)]
#[path = "handoff_tests.rs"]
mod tests;
