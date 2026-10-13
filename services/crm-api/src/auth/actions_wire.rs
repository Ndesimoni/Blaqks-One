//! The JSON shape of [`Actions`]: each module lists only the keys it supports.
//! Every key is required and unknown keys are refused, so requests decode strictly.
use super::{
    actions::{Actions, ModuleActions},
    permissions::Module,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Relationships {
    create: bool,
    edit: bool,
    assign: bool,
    delete_main: bool,
}

#[derive(Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Properties {
    create: bool,
    edit: bool,
    assign: bool,
    delete_activity: bool,
    delete_main: bool,
}

#[derive(Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Schedule {
    create: bool,
    edit: bool,
    assign: bool,
    delete_activity: bool,
}

#[derive(Clone, Copy, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Wire {
    relationships: Relationships,
    properties: Properties,
    schedule: Schedule,
}

impl Wire {
    /// The stored and wire key of each module.
    pub fn key(module: Module) -> &'static str {
        match module {
            Module::Relationships => "relationships",
            Module::Properties => "properties",
            Module::Schedule => "schedule",
        }
    }
}

impl From<Wire> for Actions {
    fn from(wire: Wire) -> Self {
        let (r, p, s) = (wire.relationships, wire.properties, wire.schedule);
        Self {
            relationships: ModuleActions {
                create: r.create,
                edit: r.edit,
                assign: r.assign,
                delete_activity: false,
                delete_main: r.delete_main,
            },
            properties: ModuleActions {
                create: p.create,
                edit: p.edit,
                assign: p.assign,
                delete_activity: p.delete_activity,
                delete_main: p.delete_main,
            },
            schedule: ModuleActions {
                create: s.create,
                edit: s.edit,
                assign: s.assign,
                delete_activity: s.delete_activity,
                delete_main: false,
            },
        }
    }
}

impl From<Actions> for Wire {
    fn from(actions: Actions) -> Self {
        let (r, p, s) = (actions.relationships, actions.properties, actions.schedule);
        Self {
            relationships: Relationships {
                create: r.create,
                edit: r.edit,
                assign: r.assign,
                delete_main: r.delete_main,
            },
            properties: Properties {
                create: p.create,
                edit: p.edit,
                assign: p.assign,
                delete_activity: p.delete_activity,
                delete_main: p.delete_main,
            },
            schedule: Schedule {
                create: s.create,
                edit: s.edit,
                assign: s.assign,
                delete_activity: s.delete_activity,
            },
        }
    }
}

/// Invitations may omit `deleteMain` (it can only be false there); every other key
/// stays required and unknown keys are still refused.
pub fn invitation(mut value: serde_json::Value) -> Option<Actions> {
    for module in [Module::Relationships, Module::Properties] {
        if let Some(flags) = value
            .get_mut(Wire::key(module))
            .and_then(|flags| flags.as_object_mut())
        {
            flags
                .entry("deleteMain")
                .or_insert(serde_json::Value::Bool(false));
        }
    }
    serde_json::from_value(value).ok()
}
