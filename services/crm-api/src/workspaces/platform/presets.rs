//! The positions the Owner starts a Blaqks One team member from (owner 2026-11-05). A
//! preset only names the position and fills the starting levels; the saved levels decide.
use super::areas::{Access, Area, Level, ALL};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Preset {
    Manager,
    Sales,
    Support,
    Analyst,
    Custom,
}

pub const PRESETS: [Preset; 5] = [
    Preset::Manager,
    Preset::Sales,
    Preset::Support,
    Preset::Analyst,
    Preset::Custom,
];

impl Preset {
    pub fn parse(key: &str) -> Option<Self> {
        PRESETS.into_iter().find(|preset| preset.key() == key)
    }

    pub fn key(self) -> &'static str {
        match self {
            Self::Manager => "manager",
            Self::Sales => "sales",
            Self::Support => "support",
            Self::Analyst => "analyst",
            Self::Custom => "custom",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Manager => "Manager",
            Self::Sales => "Sales",
            Self::Support => "Support",
            Self::Analyst => "Analyst",
            Self::Custom => "Custom",
        }
    }

    /// The levels the position starts with; Custom starts with none.
    pub fn access(self) -> Access {
        match self {
            Self::Manager => ALL.into_iter().map(|area| (area, area.highest())).collect(),
            Self::Sales => vec![
                (Area::Companies, Level::View),
                (Area::Clients, Level::Manage),
            ],
            Self::Support => vec![
                (Area::Companies, Level::View),
                (Area::HelpRequests, Level::Manage),
            ],
            Self::Analyst => vec![(Area::Dashboard, Level::View)],
            Self::Custom => Vec::new(),
        }
    }
}
