//! The only definition of which records a caller may see (assignments contract §3).
//! Every result is additionally limited to the caller's granted collections.
use crate::auth::profile::UserRow;
use uuid::Uuid;

/// Collections that carry `assignee_id`.
pub const ASSIGNABLE: [&str; 4] = ["Clients", "Properties", "Contacts", "Follow-ups"];
/// Parent records: deleting one needs team scope, deleteMain and reference coverage
/// (H2, A2 M-C), and they fall to the Admin queue.
pub const PARENTS: [&str; 3] = ["Clients", "Properties", "Contacts"];
/// Activity records whose visibility follows their linked client.
pub const CHILDREN: [&str; 5] = [
    "Follow-ups",
    "Viewings",
    "Shortlist",
    "Interaction log",
    "Client care",
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RecordScope {
    /// Admin, Super Admin or staff with the full-team grant: every row in the workspace.
    Team,
    /// Assigned-only staff: rows they hold, children of clients they hold, and the
    /// owner Contacts of properties they hold.
    Assigned(Uuid),
}

impl RecordScope {
    /// Derive the scope from a profile; for writes and lists this must be the row
    /// re-read inside the transaction (H4).
    pub fn of(user: &UserRow) -> Self {
        if user.has_team_scope() {
            Self::Team
        } else {
            Self::Assigned(user.id)
        }
    }

    /// Value bound to the `caller` placeholder of [`predicate`]; NULL means team scope.
    pub fn caller(self) -> Option<Uuid> {
        match self {
            Self::Team => None,
            Self::Assigned(id) => Some(id),
        }
    }

    pub fn is_team(self) -> bool {
        self == Self::Team
    }
}

/// SQL condition that the `crm_records` row aliased `alias` is visible. `workspace`
/// and `caller` are placeholders such as `$1`; bind [`RecordScope::caller`] to
/// `caller`. Hidden and unknown rows are therefore filtered by one query.
pub fn predicate(alias: &str, workspace: &str, caller: &str) -> String {
    format!(
        "({caller}::uuid IS NULL OR {alias}.assignee_id={caller} \
         OR ({alias}.collection IN \
         ('Follow-ups','Viewings','Shortlist','Interaction log','Client care') \
         AND {alias}.client_ref IN (SELECT held.legacy_id FROM crm_records held \
         WHERE held.workspace_id={workspace} AND held.collection='Clients' \
         AND held.assignee_id={caller})) \
         OR ({alias}.collection='Contacts' AND {alias}.legacy_id IN \
         (SELECT held.contact_id FROM crm_records held WHERE held.workspace_id={workspace} \
         AND held.collection='Properties' AND held.assignee_id={caller})))"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scope_follows_the_profile_and_the_predicate_covers_children() {
        let staff = Uuid::new_v4();
        assert_eq!(RecordScope::Assigned(staff).caller(), Some(staff));
        assert_eq!(RecordScope::Team.caller(), None);
        let sql = predicate("r", "$1", "$4");
        assert!(sql.starts_with("($4::uuid IS NULL OR r.assignee_id=$4"));
        assert!(sql.contains("held.workspace_id=$1") && !sql.contains("$2"));
        for collection in CHILDREN {
            assert!(sql.contains(&format!("'{collection}'")));
        }
    }
}
