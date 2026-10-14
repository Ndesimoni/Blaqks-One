//! Per-module action grants (docs/action-permissions-design.md §3, §12).
//! Module grants mean "can view"; these flags decide what a staff member may change.
use super::{
    actions_wire::Wire,
    finance_access::FinanceActions,
    permissions::{Module, Permissions},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// One module's flags. `delete_activity` is always false for relationships and
/// `delete_main` always false for schedule; the wire format has no such keys.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct ModuleActions {
    pub create: bool,
    pub edit: bool,
    pub assign: bool,
    pub delete_activity: bool,
    pub delete_main: bool,
}

/// Request bodies decode strictly (complete object, no unknown keys, booleans only).
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(from = "Wire", into = "Wire")]
pub struct Actions {
    pub relationships: ModuleActions,
    pub properties: ModuleActions,
    pub schedule: ModuleActions,
    /// The finance key (finance-design §5.1); never read by `UserRow::can`.
    pub finance: FinanceActions,
}

impl Actions {
    fn each(finance: FinanceActions, flags: impl Fn(Module) -> ModuleActions) -> Self {
        let mut actions = Self {
            relationships: flags(Module::Relationships),
            properties: flags(Module::Properties),
            schedule: flags(Module::Schedule),
            finance,
        };
        actions.relationships.delete_activity = false;
        actions.schedule.delete_main = false;
        actions
    }

    /// Admins and the Super Admin: every record action by role; finance follows the
    /// role (`FinanceActions::by_role`).
    pub fn full(role: &str) -> Self {
        Self::each(FinanceActions::by_role(role), |_| ModuleActions {
            create: true,
            edit: true,
            assign: true,
            delete_activity: true,
            delete_main: true,
        })
    }

    /// Position preset for granted modules; deleteMain, finance approve and teamView are
    /// never granted by default.
    pub fn preset(permissions: &Permissions) -> Self {
        Self::each(FinanceActions::preset(permissions), |module| {
            let on = module.granted(permissions);
            ModuleActions {
                create: on,
                edit: on,
                assign: on,
                delete_activity: on,
                delete_main: false,
            }
        })
    }

    /// Lenient stored decoder (M-E): unknown keys are ignored and any value other
    /// than JSON `true` is false, so a malformed row never fails decoding.
    pub fn from_stored(value: &Value) -> Self {
        Self::each(FinanceActions::from_stored(value), |module| {
            let name = Wire::key(module);
            let flag = |key: &str| {
                value.get(name).and_then(|flags| flags.get(key)) == Some(&Value::Bool(true))
            };
            ModuleActions {
                create: flag("create"),
                edit: flag("edit"),
                assign: flag("assign"),
                delete_activity: flag("deleteActivity"),
                delete_main: flag("deleteMain"),
            }
        })
    }

    /// Save invariants: a module that is off has no actions, and deleteMain needs
    /// whole-team scope.
    pub fn normalised(self, permissions: &Permissions, team: bool) -> Self {
        Self::each(self.finance.normalised(permissions, team), |module| {
            let mut flags = self.module(module);
            if !module.granted(permissions) {
                flags = ModuleActions::default();
            }
            flags.delete_main &= team;
            flags
        })
    }

    /// M-D, for a member update without explicit `actions`: a module newly switched on
    /// gets its preset, a module still on keeps its stored flags, and positions never
    /// widen an enabled module. Then the save invariants apply.
    pub fn carried_over(self, before: &Permissions, after: &Permissions, team: bool) -> Self {
        let preset = Self::preset(after);
        let finance = match before.finance {
            true => self.finance,
            false => preset.finance,
        };
        Self::each(finance, |module| match module.granted(before) {
            true => self.module(module),
            false => preset.module(module),
        })
        .normalised(after, team)
    }

    pub fn module(&self, module: Module) -> ModuleActions {
        match module {
            Module::Relationships => self.relationships,
            Module::Properties => self.properties,
            Module::Schedule => self.schedule,
        }
    }

    /// Decodes an invitation's `actions`, where `deleteMain` may be omitted.
    pub fn from_invitation(value: Value) -> Option<Self> {
        super::actions_request::invitation(value)
    }

    pub fn deletes_main(&self) -> bool {
        self.relationships.delete_main || self.properties.delete_main
    }
}

#[cfg(test)]
#[path = "actions_tests.rs"]
mod tests;
