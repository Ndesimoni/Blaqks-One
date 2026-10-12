use crate::auth::permissions::{ChannelAccess, Permissions};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    pub id: &'static str,
    pub label: &'static str,
    pub permissions: Permissions,
    pub channel_access: ChannelAccess,
}

pub fn positions() -> Vec<Position> {
    [
        (
            "receptionist",
            "Receptionist",
            true,
            false,
            true,
            false,
            false,
        ),
        (
            "lead-manager",
            "Lead Manager",
            true,
            false,
            true,
            false,
            true,
        ),
        (
            "property-agent",
            "Property Agent",
            true,
            true,
            true,
            false,
            true,
        ),
        (
            "listing-coordinator",
            "Listing Coordinator",
            true,
            true,
            false,
            false,
            false,
        ),
        ("accountant", "Accountant", false, false, false, true, true),
        (
            "property-manager",
            "Property Manager",
            true,
            true,
            true,
            false,
            true,
        ),
        (
            "marketing-coordinator",
            "Marketing Coordinator",
            true,
            false,
            false,
            false,
            true,
        ),
        (
            "team-supervisor",
            "Team Supervisor",
            true,
            true,
            true,
            false,
            true,
        ),
    ]
    .into_iter()
    .map(
        |(id, label, relationships, properties, schedule, finance, reports)| Position {
            id,
            label,
            permissions: Permissions {
                relationships,
                properties,
                schedule,
                finance,
                reports,
                exports: false,
            },
            channel_access: ChannelAccess::default(),
        },
    )
    .collect()
}

pub fn defaults(selected: &[String]) -> Option<Permissions> {
    if selected.is_empty() || selected.len() > 8 {
        return None;
    }
    let catalogue = positions();
    let mut result = Permissions::default();
    let mut seen = std::collections::HashSet::new();
    for id in selected {
        if !seen.insert(id) {
            return None;
        }
        let position = catalogue.iter().find(|position| position.id == id)?;
        let permissions = &position.permissions;
        result.relationships |= permissions.relationships;
        result.properties |= permissions.properties;
        result.schedule |= permissions.schedule;
        result.finance |= permissions.finance;
        result.reports |= permissions.reports;
    }
    Some(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn combinations_union_modules_without_granting_management_or_channels() {
        let permissions = defaults(&["receptionist".into(), "accountant".into()]).unwrap();
        assert!(permissions.relationships && permissions.finance);
        assert!(!permissions.properties && !permissions.exports);
        assert!(defaults(&["super-admin".into()]).is_none());
        assert!(defaults(&["receptionist".into(), "receptionist".into()]).is_none());
        assert!(positions().iter().all(|role| !role.channel_access.email));
    }
}
