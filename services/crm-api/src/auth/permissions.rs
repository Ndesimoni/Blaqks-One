use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
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
        Module::of(collection).is_some_and(|module| module.granted(self))
    }
}

/// The connected modules that carry record collections and action grants.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Module {
    Relationships,
    Properties,
    Schedule,
}

impl Module {
    pub const ALL: [Self; 3] = [Self::Relationships, Self::Properties, Self::Schedule];

    pub fn of(collection: &str) -> Option<Self> {
        match collection {
            "Clients" | "Contacts" => Some(Self::Relationships),
            "Properties" | "Shortlist" => Some(Self::Properties),
            "Follow-ups" | "Viewings" | "Interaction log" | "Client care" => Some(Self::Schedule),
            _ => None,
        }
    }

    pub fn granted(self, permissions: &Permissions) -> bool {
        match self {
            Self::Relationships => permissions.relationships,
            Self::Properties => permissions.properties,
            Self::Schedule => permissions.schedule,
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
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
        assert!(!access.collection("Viewings"));
        let schedule = Permissions {
            schedule: true,
            ..Default::default()
        };
        assert!(schedule.collection("Follow-ups") && schedule.collection("Client care"));
        assert!(!schedule.collection("Shortlist") && !schedule.collection("Deals"));
        assert!(!Permissions::full().collection("Anything"));
        assert!(serde_json::from_str::<Permissions>("{\"admin\":true}").is_err());
        assert!(!ChannelAccess::default().email);
    }
}
