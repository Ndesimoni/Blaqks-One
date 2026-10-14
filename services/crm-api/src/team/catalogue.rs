use super::positions::TABLE;
use crate::auth::{
    actions::Actions,
    permissions::{ChannelAccess, Permissions},
};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    pub id: &'static str,
    pub label: &'static str,
    pub permissions: Permissions,
    pub channel_access: ChannelAccess,
    /// Action preset for the modules this position grants (deleteMain always false).
    pub actions: Actions,
}

pub fn positions() -> Vec<Position> {
    TABLE
        .into_iter()
        .map(
            |(id, label, [relationships, properties, schedule, finance, reports])| {
                let permissions = Permissions {
                    relationships,
                    properties,
                    schedule,
                    finance,
                    reports,
                    exports: false,
                };
                Position {
                    id,
                    label,
                    actions: Actions::preset(&permissions),
                    permissions,
                    channel_access: ChannelAccess::default(),
                }
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

    #[test]
    fn presets_follow_granted_modules_and_never_delete_main_records() {
        for position in positions() {
            let actions = position.actions;
            assert!(!actions.deletes_main(), "{}", position.id);
            assert_eq!(actions.schedule.create, position.permissions.schedule);
            assert_eq!(
                actions.properties.delete_activity,
                position.permissions.properties
            );
        }
        let receptionist = &positions()[0];
        assert!(receptionist.actions.relationships.assign && !receptionist.actions.properties.edit);
    }
}
