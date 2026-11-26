//! Four fictional Blaqks One team members, one per position, so the Owner can sign in as each
//! and see what their access opens, and who does what in the other samples.
use super::{super::data, team::Member};
use crate::workspaces::platform::presets::Preset;
use std::collections::BTreeMap;
use uuid::Uuid;

pub struct Spec {
    pub person: &'static str,
    pub handle: &'static str,
    pub phone: &'static str,
    pub preset: Preset,
}

pub const SPECS: [Spec; 4] = [
    Spec {
        person: "Grace Mensah",
        handle: "sample.grace",
        phone: "+971500000911",
        preset: Preset::Manager,
    },
    Spec {
        person: "Omar Haddad",
        handle: "sample.omar",
        phone: "+971500000912",
        preset: Preset::Sales,
    },
    Spec {
        person: "Priya Raman",
        handle: "sample.priya",
        phone: "+971500000913",
        preset: Preset::Support,
    },
    Spec {
        person: "Daniel Ruiz",
        handle: "sample.daniel",
        phone: "+971500000914",
        preset: Preset::Analyst,
    },
];

impl Spec {
    pub fn name(&self) -> String {
        data::name(self.person)
    }

    /// `sample.grace+<owner email local part>@example.test`, like the company sample staff.
    pub fn email(&self, owner_email: &str) -> String {
        let local: String = owner_email
            .split('@')
            .next()
            .unwrap_or_default()
            .chars()
            .filter(char::is_ascii_alphanumeric)
            .take(24)
            .collect();
        format!("{}+{}@example.test", self.handle, local.to_lowercase())
    }

    pub fn access(&self) -> BTreeMap<&'static str, &'static str> {
        let levels = self.preset.access().into_iter();
        levels
            .map(|(area, level)| (area.key(), level.key()))
            .collect()
    }
}

/// Who does something in a sample: the Owner, one of the four members, or nobody.
#[derive(Clone, Copy)]
pub enum Who {
    Owner,
    Grace,
    Omar,
    Priya,
    Daniel,
    Nobody,
}

/// The live accounts behind `Who`; a member who is not live (or not seeded) falls back to
/// the Owner, so every sample still reads naturally.
pub struct People {
    pub owner: Uuid,
    members: [Option<Uuid>; 4],
}

impl People {
    pub fn new(owner: Uuid, members: &[Member]) -> Self {
        let mut ids = [None; 4];
        for (slot, member) in ids.iter_mut().zip(members) {
            *slot = member.id;
        }
        Self {
            owner,
            members: ids,
        }
    }

    pub fn id(&self, who: Who) -> Option<Uuid> {
        let index = match who {
            Who::Owner => return Some(self.owner),
            Who::Nobody => return None,
            Who::Grace => 0,
            Who::Omar => 1,
            Who::Priya => 2,
            Who::Daniel => 3,
        };
        Some(self.members[index].unwrap_or(self.owner))
    }

    /// Only the members who are live, for chat messages that would read oddly from the Owner.
    pub fn live(&self, who: Who) -> Option<Uuid> {
        match who {
            Who::Owner | Who::Nobody => self.id(who),
            _ => self.id(who).filter(|id| *id != self.owner),
        }
    }
}
