//! What one profile may do with each connected collection (action-permissions §3, §12).
//! The frontend reads `recordActions` and never re-derives these rules.
use super::{actions::Actions, actions_wire::Wire, permissions::Module, profile::UserRow};
use crate::{
    error::{ApiError, ApiResult},
    records::{
        collections::COLLECTIONS,
        visibility::{ASSIGNABLE, PARENTS},
    },
};
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Action {
    Create,
    Edit,
    Delete,
    Assign,
}

pub const ASSIGN_DENIED: &str = "Your access doesn't include handing on these records.";

impl Action {
    /// The caller-dependent 403 for a missing action (never depends on the target).
    pub fn denied(self) -> ApiError {
        ApiError::denied(match self {
            Self::Create => "Your access doesn't include adding these records.",
            Self::Edit => "Your access doesn't include editing these records.",
            Self::Delete => "Ask your Admin to delete this record.",
            Self::Assign => ASSIGN_DENIED,
        })
    }
}

/// Effective `{create, edit, delete, assign}` for one collection.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
pub struct RecordActions {
    pub create: bool,
    pub edit: bool,
    pub delete: bool,
    pub assign: bool,
}

impl UserRow {
    /// Role allowlist: Admins and the Super Admin hold every action by role, staff hold
    /// their stored grants normalised against modules and scope, any other role nothing.
    pub fn effective_actions(&self) -> Actions {
        match self.role.as_str() {
            "admin" | "super-admin" => Actions::full(),
            "staff" => Actions::from_stored(&self.actions.0)
                .normalised(&self.permissions.0, self.has_team_scope()),
            _ => Actions::default(),
        }
    }

    /// Whether any action grant was ever stored. Staff archived before 0009 keep `{}`.
    pub fn actions_recorded(&self) -> bool {
        Module::ALL
            .iter()
            .any(|module| self.actions.0.get(Wire::key(*module)).is_some())
    }

    /// The profile's `actions`: `{}` for staff whose grants were never recorded.
    pub fn profile_actions(&self) -> Value {
        if self.role == "staff" && !self.actions_recorded() {
            return json!({});
        }
        serde_json::to_value(self.effective_actions()).unwrap_or_else(|_| json!({}))
    }

    /// M-C: every collection that can link to `collection` must be visible too, so a
    /// foreign-key refusal never reveals records in a module the caller cannot see.
    pub fn covers_references(&self, collection: &str) -> bool {
        let permissions = self.effective_permissions();
        COLLECTIONS
            .iter()
            .filter(|linking| linking.links.iter().any(|link| link.target == collection))
            .all(|linking| permissions.collection(linking.name))
    }

    /// `can(collection, action)`: false without the module; parents need team scope,
    /// deleteMain and referencing-module coverage to be deleted.
    pub fn can(&self, collection: &str, action: Action) -> bool {
        let Some(module) = Module::of(collection) else {
            return false;
        };
        if !self.can_collection(collection) {
            return false;
        }
        let flags = self.effective_actions().module(module);
        match action {
            Action::Create => flags.create,
            Action::Edit => flags.edit,
            Action::Assign => ASSIGNABLE.contains(&collection) && flags.assign,
            Action::Delete if PARENTS.contains(&collection) => {
                self.has_team_scope() && flags.delete_main && self.covers_references(collection)
            }
            Action::Delete => flags.delete_activity,
        }
    }

    /// Step 2, repeated on the live row at step 4: the module grant ("Access denied."),
    /// then the action (its own message). Depends only on the caller and collection.
    pub fn ensure(&self, collection: &str, action: Action) -> ApiResult<()> {
        if !self.can_collection(collection) {
            return Err(ApiError::forbidden());
        }
        if !self.can(collection, action) {
            return Err(action.denied());
        }
        Ok(())
    }

    /// `recordActions` for all eight connected collections.
    pub fn record_actions(&self) -> BTreeMap<&'static str, RecordActions> {
        COLLECTIONS
            .iter()
            .map(|collection| {
                let name = collection.name;
                let actions = RecordActions {
                    create: self.can(name, Action::Create),
                    edit: self.can(name, Action::Edit),
                    delete: self.can(name, Action::Delete),
                    assign: self.can(name, Action::Assign),
                };
                (name, actions)
            })
            .collect()
    }
}

#[cfg(test)]
#[path = "grants_tests.rs"]
mod tests;
