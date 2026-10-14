//! Three fictional staff members showing record scope, action grants and channels.
//! Positions set module defaults exactly as invitations do (`team::catalogue`).
use crate::{
    auth::{
        actions::Actions,
        permissions::{ChannelAccess, Permissions},
    },
    team::catalogue,
};

pub struct Spec {
    pub person: &'static str,
    /// Email local part before the team suffix, for example `sample.layla`.
    pub handle: &'static str,
    pub phone: &'static str,
    pub position: &'static str,
    pub team_scope: bool,
    /// Module views only: every create, edit, assign and delete action is off.
    pub view_only: bool,
    pub channels: ChannelAccess,
    pub summary: &'static str,
    /// Sample record IDs this member holds after seeding.
    pub holds: &'static [&'static str],
}

pub const SPECS: [Spec; 3] = [
    Spec {
        person: "Layla Nasser",
        handle: "sample.layla",
        phone: "+971500000901",
        position: "property-agent",
        team_scope: false,
        view_only: false,
        channels: ChannelAccess {
            email: false,
            whatsapp: true,
        },
        summary: "assigned records only, standard actions, WhatsApp",
        holds: &["CL-S02", "CL-S04", "CL-S09", "PR-S02", "PR-S03", "CT-S07"],
    },
    Spec {
        person: "Karim Aziz",
        handle: "sample.karim",
        phone: "+971500000902",
        position: "team-supervisor",
        team_scope: true,
        view_only: false,
        channels: ChannelAccess {
            email: true,
            whatsapp: true,
        },
        summary: "whole team, can delete clients & contacts, email and WhatsApp",
        holds: &[
            "CL-S01", "CL-S06", "PR-S05", "PR-S07", "PR-S08", "CT-S03", "CT-S04",
        ],
    },
    Spec {
        person: "Noura Saleh",
        handle: "sample.noura",
        phone: "+971500000903",
        position: "lead-manager",
        team_scope: false,
        view_only: true,
        channels: ChannelAccess {
            email: false,
            whatsapp: false,
        },
        summary: "assigned records only, view-only",
        holds: &["CL-S03", "CL-S05", "CT-S08"],
    },
];

impl Spec {
    pub fn name(&self) -> String {
        super::data::name(self.person)
    }

    /// Unique per team: `sample.layla+<admin email local part>@example.test`.
    pub fn email(&self, admin_email: &str) -> String {
        let local: String = admin_email
            .split('@')
            .next()
            .unwrap_or_default()
            .chars()
            .filter(char::is_ascii_alphanumeric)
            .take(24)
            .collect();
        format!("{}+{}@example.test", self.handle, local.to_lowercase())
    }

    pub fn positions(&self) -> Vec<String> {
        vec![self.position.to_owned()]
    }

    pub fn permissions(&self) -> Permissions {
        catalogue::defaults(&self.positions()).unwrap_or_default()
    }

    /// Standard preset; the whole-team member also deletes clients and contacts; the
    /// view-only member holds no actions at all.
    pub fn actions(&self) -> Actions {
        if self.view_only {
            return Actions::default();
        }
        let permissions = self.permissions();
        let mut actions = Actions::preset(&permissions);
        actions.relationships.delete_main = self.team_scope;
        actions.normalised(&permissions, self.team_scope)
    }

    pub fn record_scope(&self) -> &'static str {
        if self.team_scope {
            "team"
        } else {
            "assigned"
        }
    }
}

#[cfg(test)]
#[path = "staff_tests.rs"]
mod tests;
