//! Which assignee an assigned-only caller may choose (contract §5, §6).
use crate::{
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

#[cfg(test)]
#[path = "handoff_tests.rs"]
mod tests;
