//! The `finance` action key and effective finance access (finance-design §5.1, §13).
//! Finance authorisation never goes through `UserRow::can` (L-F2): handlers read
//! `UserRow::finance_access()`, which the profile exposes as `financeAccess`.
use super::{permissions::Permissions, profile::UserRow};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const NEEDS_TEAM: &str = "Approving and team finance need whole-team visibility.";
pub const APPROVE_NEEDS_VIEW: &str = "Approving finance records needs See team finance.";

/// Stored and wire flags. The wire decoder is strict: every key, booleans only.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FinanceActions {
    pub create: bool,
    pub edit: bool,
    pub assign: bool,
    pub approve: bool,
    pub team_view: bool,
}

impl FinanceActions {
    /// Position and invitation preset: approve and teamView are never granted by default.
    pub fn preset(permissions: &Permissions) -> Self {
        let on = permissions.finance;
        Self {
            create: on,
            edit: on,
            assign: on,
            ..Self::default()
        }
    }

    /// Role-based flags for Admins. The Super Admin has no finance actions inside a
    /// company (§13); it keeps the team view it has by role.
    pub fn by_role(role: &str) -> Self {
        match role {
            "admin" => Self {
                create: true,
                edit: true,
                assign: true,
                approve: true,
                team_view: true,
            },
            "super-admin" => Self {
                team_view: true,
                ..Self::default()
            },
            _ => Self::default(),
        }
    }

    /// Lenient stored decoder: any value other than JSON `true` is false.
    pub fn from_stored(value: &Value) -> Self {
        let flag = |key: &str| {
            value.get("finance").and_then(|flags| flags.get(key)) == Some(&Value::Bool(true))
        };
        Self {
            create: flag("create"),
            edit: flag("edit"),
            assign: flag("assign"),
            approve: flag("approve"),
            team_view: flag("teamView"),
        }
    }

    /// Save invariants: no finance module, no flags; teamView needs whole-team scope;
    /// approve needs teamView.
    pub fn normalised(self, permissions: &Permissions, team: bool) -> Self {
        if !permissions.finance {
            return Self::default();
        }
        let team_view = self.team_view && team;
        Self {
            team_view,
            approve: self.approve && team_view,
            ..self
        }
    }
}

/// Whose finance records a caller sees: the whole team, their own, or none.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FinanceScope {
    Team,
    Own,
    None,
}

/// The profile's `financeAccess`. `manage` covers the role-based Admin-only operations
/// (settings, agreements, overrides, revise, unearn, void, approved edits, deal deletes).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FinanceAccess {
    pub scope: FinanceScope,
    pub create: bool,
    pub edit: bool,
    pub assign: bool,
    pub approve: bool,
    pub team_view: bool,
    pub manage: bool,
}

impl UserRow {
    /// Role allowlist: Admins hold every finance action and `manage`; the Super Admin
    /// views only; staff hold their stored grants normalised against the finance module
    /// and record scope; any other role gets nothing.
    pub fn finance_access(&self) -> FinanceAccess {
        let module = self.effective_permissions().finance;
        let flags = match self.role.as_str() {
            "admin" | "super-admin" => FinanceActions::by_role(&self.role),
            "staff" => FinanceActions::from_stored(&self.actions.0)
                .normalised(&self.permissions.0, self.has_team_scope()),
            _ => FinanceActions::default(),
        };
        let scope = match (module, flags.team_view) {
            (true, true) => FinanceScope::Team,
            (true, false) => FinanceScope::Own,
            (false, _) => FinanceScope::None,
        };
        FinanceAccess {
            scope,
            create: flags.create,
            edit: flags.edit,
            assign: flags.assign,
            approve: flags.approve,
            team_view: flags.team_view,
            manage: self.role == "admin",
        }
    }
}

#[cfg(test)]
#[path = "finance_access_tests.rs"]
mod tests;
