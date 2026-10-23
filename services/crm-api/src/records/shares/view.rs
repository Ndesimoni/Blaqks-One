//! How a share reads (docs/record-sharing.md R1, amendment 7): type, a label, the two
//! members, status and dates, and the actions this caller may take. The label is a listing
//! title and community, or a person's first name and last initial — shown only while the
//! share is open to a caller who sees the record or is its colleague. No other field.
use super::store::ShareRow;
use crate::{agreements::handover_terms::display_name, auth::profile::UserRow};
use serde_json::{json, Value};
use uuid::Uuid;

/// Who is asking: their ID and whether they are this company's Admin.
#[derive(Clone, Copy, Debug)]
pub struct Caller {
    pub id: Uuid,
    pub admin: bool,
}

impl Caller {
    pub fn of(user: &UserRow, workspace: &str) -> Self {
        Self {
            id: user.id,
            admin: user.role == "admin" && user.workspace_id == workspace,
        }
    }
}

impl ShareRow {
    pub fn open(&self) -> bool {
        matches!(self.status.as_str(), "pending" | "accepted")
    }

    /// The colleague, the sender, the record's current holder and the Admin.
    pub fn party(&self, caller: Caller) -> bool {
        caller.admin
            || [self.to_id, self.from_id].contains(&caller.id)
            || self.holder_id == Some(caller.id)
    }

    fn label(&self, caller: Caller) -> Value {
        let shown = self.open() && (self.caller_sees == Some(true) || self.to_id == caller.id);
        if !shown {
            return Value::Null;
        }
        let clip = |text: &str, max: usize| text.trim().chars().take(max).collect::<String>();
        match self.collection.as_str() {
            "Properties" => {
                let title = clip(self.title.as_deref().unwrap_or("Listing"), 120);
                match self
                    .community
                    .as_deref()
                    .map(str::trim)
                    .filter(|c| !c.is_empty())
                {
                    Some(area) => json!(format!("{title} · {}", clip(area, 80))),
                    None => json!(title),
                }
            }
            _ => json!(display_name(self.person.as_deref())),
        }
    }

    pub fn view(&self, caller: Caller) -> Value {
        let me = caller.id;
        let (pending, accepted) = (self.status == "pending", self.status == "accepted");
        let sender_side = me == self.from_id || caller.admin;
        let allowed = json!({"accept": pending && me == self.to_id,
            "decline": pending && me == self.to_id,
            "withdraw": pending && sender_side,
            "stop": accepted && (sender_side || self.holder_id == Some(me))});
        json!({"id": self.id, "collection": self.collection, "label": self.label(caller),
            "from": {"id": self.from_id, "name": self.from_name},
            "to": {"id": self.to_id, "name": self.to_name}, "status": self.status,
            "createdAt": self.created_at,
            "expiresAt": if pending { Some(&self.expires_at) } else { None },
            "decidedAt": self.decided_at, "closedAt": self.closed_at, "allowed": allowed})
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(status: &str) -> ShareRow {
        ShareRow {
            id: Uuid::from_u128(1),
            record_id: Uuid::from_u128(2),
            collection: "Properties".into(),
            from_id: Uuid::from_u128(3),
            from_name: "Sender".into(),
            to_id: Uuid::from_u128(4),
            to_name: "Colleague".into(),
            status: status.into(),
            holder_id: Some(Uuid::from_u128(3)),
            title: Some("Canal apartment".into()),
            community: Some("Business Bay".into()),
            person: None,
            created_at: "created".into(),
            expires_at: "expires".into(),
            decided_at: None,
            closed_at: None,
            caller_sees: Some(false),
        }
    }

    #[test]
    fn pending_colleagues_see_only_the_offer_label_and_their_actions() {
        let share = row("pending").view(Caller {
            id: Uuid::from_u128(4),
            admin: false,
        });
        assert_eq!(share["label"], "Canal apartment · Business Bay");
        assert_eq!(share["allowed"]["accept"], true);
        assert_eq!(share["allowed"]["decline"], true);
        assert_eq!(share["allowed"]["withdraw"], false);
        assert!(share.get("recordId").is_none());
    }

    #[test]
    fn closed_shares_hide_the_record_label_and_offer_no_action() {
        let share = row("stopped").view(Caller {
            id: Uuid::from_u128(3),
            admin: false,
        });
        assert!(share["label"].is_null());
        assert_eq!(
            share["allowed"],
            json!({
                "accept":false,"decline":false,"withdraw":false,"stop":false
            })
        );
    }
}
