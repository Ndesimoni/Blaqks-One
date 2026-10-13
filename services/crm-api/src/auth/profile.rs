use super::permissions::{ChannelAccess, Permissions};
use serde::{Deserialize, Serialize};
use sqlx::{types::Json, FromRow};
use uuid::Uuid;

#[derive(Clone, FromRow)]
pub struct UserRow {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub phone: String,
    pub role: String,
    pub owner_id: Option<Uuid>,
    pub workspace_id: String,
    pub positions: Json<Vec<String>>,
    pub permissions: Json<Permissions>,
    pub channel_access: Json<ChannelAccess>,
    /// Raw `crm_users.record_scope`; only meaningful for staff.
    pub record_scope: String,
}

impl UserRow {
    /// Admins and the Super Admin see their whole team by role; staff need the grant.
    /// An allowlist, so any other role string falls back to assigned-only.
    pub fn has_team_scope(&self) -> bool {
        matches!(self.role.as_str(), "admin" | "super-admin")
            || (self.role == "staff" && self.record_scope == "team")
    }

    pub fn record_scope_label(&self) -> &'static str {
        if self.has_team_scope() {
            "team"
        } else {
            "assigned"
        }
    }

    pub fn effective_permissions(&self) -> Permissions {
        if self.role == "staff" {
            self.permissions.0.clone()
        } else {
            Permissions::full()
        }
    }

    pub fn can_collection(&self, collection: &str) -> bool {
        self.effective_permissions().collection(collection)
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub phone: String,
    pub role: String,
    pub role_id: String,
    pub owner_id: Uuid,
    pub workspace_id: String,
    pub positions: Vec<String>,
    pub manages_team: bool,
    pub status: String,
    pub permissions: Permissions,
    pub channel_access: ChannelAccess,
    pub record_scope: String,
}

impl From<UserRow> for Profile {
    fn from(user: UserRow) -> Self {
        let permissions = user.effective_permissions();
        let record_scope = user.record_scope_label().into();
        Self {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: match user.role.as_str() {
                "super-admin" => "Super Admin",
                "admin" => "Admin",
                _ => "Staff",
            }
            .into(),
            manages_team: user.role != "staff",
            role_id: user.role,
            owner_id: user.owner_id.unwrap_or(user.id),
            workspace_id: user.workspace_id,
            positions: user.positions.0,
            status: "active".into(),
            permissions,
            channel_access: user.channel_access.0,
            record_scope,
        }
    }
}

#[cfg(test)]
#[path = "profile_tests.rs"]
mod tests;
