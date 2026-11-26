//! The fields PaymentView and ExpenseView share (finance-design §6.2, §5.3), with the
//! per-row `allowed` actions the server would accept, so separation-of-duties and lock
//! rules are never re-derived in the browser. The own view never names the approver of
//! a row unless the caller decided it.
use super::{
    deals::views::Viewer,
    entry::{EntryState, Kind},
    expenses, payments,
};
use crate::{auth::profile::UserRow, error::ApiResult};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Whether the viewer may decide this row: staff never decide rows they have a stake in
/// or edited since the last submission; Admins may (recorded as `selfDecided`).
pub fn separate(state: &EntryState, viewer: &Viewer) -> bool {
    viewer.access.manage || !(state.actor_party || state.actor_edited)
}

pub fn allowed(state: &EntryState, viewer: &Viewer) -> Value {
    let access = viewer.access;
    let status = state.status.as_str();
    let open = matches!(status, "pending" | "rejected");
    let decide = access.approve && status == "pending" && separate(state, viewer);
    json!({"edit": access.edit && (open || (status == "approved" && access.manage)),
        "approve": decide, "reject": decide,
        "void": access.manage && status == "approved"})
}

pub fn shared(state: &EntryState, viewer: &Viewer) -> Value {
    let decided = state
        .decided_by
        .filter(|id| viewer.team || *id == viewer.id)
        .map_or(
            Value::Null,
            |id| json!({"id": id, "name": state.decided_name}),
        );
    json!({"id": state.id, "version": state.version, "status": state.status,
        "amountFils": state.amount_fils, "notes": state.notes,
        "submittedBy": {"id": state.submitted_by, "name": state.submitted_name},
        "decidedBy": decided, "decidedAt": state.decided_at, "reason": state.decision_reason,
        "allowed": allowed(state, viewer)})
}

/// One row as `user` now sees it, or `None` when it is no longer visible.
pub async fn entry(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    user: &UserRow,
    kind: Kind,
    id: Uuid,
) -> ApiResult<Option<Value>> {
    let viewer = Viewer::of(user);
    Ok(match kind {
        Kind::Payment => payments::row::visible(tx, workspace, user, None, Some(id))
            .await?
            .first()
            .map(|row| payments::views::view(row, &viewer)),
        Kind::Expense => expenses::row::visible(tx, workspace, user, None, Some(id))
            .await?
            .first()
            .map(|row| expenses::views::view(row, &viewer)),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::finance::deals::fixtures::access;

    pub fn state(status: &str, party: bool, edited: bool) -> EntryState {
        EntryState {
            id: Uuid::new_v4(),
            version: 2,
            legacy_id: "PM-001".into(),
            status: status.into(),
            amount_fils: 2_450_000,
            notes: None,
            submitted_by: Uuid::new_v4(),
            submitted_name: "Submitter".into(),
            decided_by: (status != "pending").then(Uuid::new_v4),
            decided_name: Some("Approver".into()),
            decided_at: None,
            decision_reason: None,
            actor_party: party,
            actor_edited: edited,
        }
    }

    fn viewer(team: bool, manage: bool) -> Viewer {
        let id = Uuid::new_v4();
        let access = access(team, manage);
        Viewer { id, team, access }
    }

    #[test]
    fn staff_never_decide_their_own_rows_and_admins_may() {
        let approver = viewer(true, false);
        for (party, edited) in [(true, false), (false, true), (true, true)] {
            let row = allowed(&state("pending", party, edited), &approver);
            assert_eq!(
                (row["approve"].clone(), row["reject"].clone()),
                (json!(false), json!(false))
            );
        }
        let clean = allowed(&state("pending", false, false), &approver);
        assert_eq!(clean["approve"], json!(true));
        let admin = allowed(&state("pending", true, true), &viewer(true, true));
        assert_eq!(admin["approve"], json!(true));
    }

    #[test]
    fn locks_follow_the_status() {
        let (staff, admin) = (viewer(true, false), viewer(true, true));
        let row = |status, who: &Viewer| allowed(&state(status, false, false), who);
        assert_eq!(row("rejected", &staff)["edit"], json!(true));
        assert_eq!(
            row("approved", &staff),
            json!({"edit": false, "approve": false,
            "reject": false, "void": false})
        );
        assert_eq!(row("approved", &admin)["edit"], json!(true));
        assert_eq!(row("approved", &admin)["void"], json!(true));
        assert_eq!(
            row("void", &admin),
            json!({"edit": false, "approve": false,
            "reject": false, "void": false})
        );
        assert_eq!(row("rejected", &admin)["approve"], json!(false));
    }

    #[test]
    fn the_own_view_names_only_its_own_decisions() {
        let own = viewer(false, false);
        let row = state("rejected", false, false);
        assert_eq!(shared(&row, &own)["decidedBy"], Value::Null);
        let mut mine = row.clone();
        mine.decided_by = Some(own.id);
        assert_eq!(shared(&mine, &own)["decidedBy"]["id"], json!(own.id));
        assert_eq!(
            shared(&row, &viewer(true, false))["decidedBy"]["name"],
            "Approver"
        );
    }
}
