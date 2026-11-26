//! How an account's role reads in the interface. Blaqks One team members read
//! "Blaqks One · Support" and so on by the position they were given (BO1b).
use super::profile::UserRow;
use crate::workspaces::platform::presets::Preset;

impl UserRow {
    pub fn role_label(&self) -> String {
        match self.role.as_str() {
            "super-admin" => "Blaqks One".into(),
            "platform" => {
                let preset = self.platform_preset.as_deref().and_then(Preset::parse);
                format!("Blaqks One · {}", preset.unwrap_or(Preset::Custom).label())
            }
            "admin" => "Admin".into(),
            _ => "Staff".into(),
        }
    }
}
