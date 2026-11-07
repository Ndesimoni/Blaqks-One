//! The JSON shape of [`Actions`]: each module lists only the keys it supports.
//! Every key is required and unknown keys are refused, so requests decode strictly.
//! `finance` may be omitted by older clients; when present it must be complete.
use super::{
    actions::{Actions, ModuleActions},
    finance_access::FinanceActions,
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
    #[serde(default)]
    finance: Option<FinanceActions>,
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
            finance: wire.finance.unwrap_or_default(),
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
            finance: Some(actions.finance),
        }
    }
}
