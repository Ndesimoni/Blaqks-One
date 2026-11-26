//! Who may make which decision on a hand-over request, and at which step (agreements
//! design §17, H2 amendments 4, 5, 12 and 14). The receiver accepts or declines a pending
//! offer; the requester or an Admin cancels an open one; an Admin approves a pending offer
//! in place of a receiver other than themselves; the chosen approver (with the Approve
//! right) or an Admin approves or rejects an acceptance that waits for approval.
use super::{handover_rows::HandoverRow, handover_store::Decision, views::Viewer};
use serde_json::{json, Value};

/// Whether `viewer` takes part in `decision` at all; others get the request's 404.
pub fn may(row: &HandoverRow, decision: Decision, viewer: &Viewer) -> bool {
    let manage = viewer.access.manage;
    let me = viewer.id;
    let approver = row.approver_id == Some(me) && viewer.access.approve;
    match decision {
        Decision::Accept => row.to_id == me,
        Decision::Decline => row.to_id == me || manage,
        Decision::Cancel => row.requested_by == me || manage,
        Decision::Approve => manage && row.to_id != me,
        Decision::ApproveAcceptance | Decision::RejectAcceptance => approver || manage,
    }
}

/// Whether the request is at the step `decision` belongs to.
pub fn fits(row: &HandoverRow, decision: Decision) -> bool {
    match decision {
        Decision::Cancel => row.open(),
        Decision::ApproveAcceptance | Decision::RejectAcceptance => {
            row.status == "awaiting_approval"
        }
        _ => row.status == "pending",
    }
}

/// Whether `viewer` may open the request's preview (amendment 9): the receiver while it
/// is open, the chosen approver while it waits for them, and the company's Admin.
pub fn reviews(row: &HandoverRow, viewer: &Viewer) -> bool {
    let waiting = row.status == "awaiting_approval";
    row.open()
        && (row.to_id == viewer.id
            || (waiting && row.approver_id == Some(viewer.id) && viewer.access.approve)
            || viewer.access.manage)
}

/// The decisions the server would allow `viewer` now, for the screens.
pub fn allowed(row: &HandoverRow, viewer: &Viewer) -> Value {
    let can = |decision| may(row, decision, viewer) && fits(row, decision);
    json!({"review": reviews(row, viewer),
        "accept": can(Decision::Accept), "decline": can(Decision::Decline),
        "cancel": can(Decision::Cancel), "approve": can(Decision::Approve),
        "approveAcceptance": can(Decision::ApproveAcceptance),
        "rejectAcceptance": can(Decision::RejectAcceptance)})
}
