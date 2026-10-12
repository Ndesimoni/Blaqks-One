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
}

impl UserRow {
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
}

impl From<UserRow> for Profile {
    fn from(user: UserRow) -> Self {
        let permissions = user.effective_permissions();
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
        }
    }
}
