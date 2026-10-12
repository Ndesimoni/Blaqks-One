use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Permissions {
    pub relationships: bool,
    pub properties: bool,
    pub schedule: bool,
    pub finance: bool,
    pub reports: bool,
    pub exports: bool,
}

impl Permissions {
    pub fn full() -> Self {
        Self {
            relationships: true,
            properties: true,
            schedule: true,
            finance: true,
            reports: true,
            exports: true,
        }
    }

    pub fn collection(&self, collection: &str) -> bool {
        match collection {
            "Clients" | "Contacts" => self.relationships,
            "Properties" => self.properties,
            _ => false,
        }
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct ChannelAccess {
    pub email: bool,
    pub whatsapp: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collection_access_is_explicit_and_channels_are_separate() {
        let access = Permissions {
            relationships: true,
            ..Default::default()
        };
        assert!(access.collection("Clients"));
        assert!(access.collection("Contacts"));
        assert!(!access.collection("Properties"));
        assert!(!Permissions::full().collection("Anything"));
        assert!(serde_json::from_str::<Permissions>("{\"admin\":true}").is_err());
        assert!(!ChannelAccess::default().email);
    }
}
