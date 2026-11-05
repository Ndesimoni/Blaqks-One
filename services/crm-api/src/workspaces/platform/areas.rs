//! The Blaqks One team's areas (BO1b, docs/blaqks-one-console.md §8, owner 2026-11-05):
//! the fixed list with the levels each allows (Off, View or Manage; Manage includes View),
//! and the rule every platform handler applies to the live account. The Owner holds every
//! area at its highest level; a platform member only their saved levels; everyone else none.
use crate::auth::profile::UserRow;
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Level {
    View,
    Manage,
}

impl Level {
    pub fn key(self) -> &'static str {
        match self {
            Self::View => "view",
            Self::Manage => "manage",
        }
    }

    pub fn parse(key: &str) -> Option<Self> {
        [Self::View, Self::Manage]
            .into_iter()
            .find(|level| level.key() == key)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Area {
    Dashboard,
    /// View: the company list and its people; Manage: suspend, reactivate and archive
    /// them, and seat limits.
    Companies,
    InviteAdmins,
    Marketplace,
    PlatformWebsite,
    /// Reserved until help requests (BO1c) ship.
    HelpRequests,
    /// Blaqks One's own sales clients; reserved until that feature ships.
    Clients,
}

pub const ALL: [Area; 7] = [
    Area::Dashboard,
    Area::Companies,
    Area::InviteAdmins,
    Area::Marketplace,
    Area::PlatformWebsite,
    Area::HelpRequests,
    Area::Clients,
];

impl Area {
    pub fn key(self) -> &'static str {
        match self {
            Self::Dashboard => "dashboard",
            Self::Companies => "companies",
            Self::InviteAdmins => "invite_admins",
            Self::Marketplace => "marketplace",
            Self::PlatformWebsite => "platform_website",
            Self::HelpRequests => "help_requests",
            Self::Clients => "clients",
        }
    }

    pub fn parse(key: &str) -> Option<Self> {
        ALL.into_iter().find(|area| area.key() == key)
    }

    /// The levels this area can be given, lowest first.
    pub fn levels(self) -> &'static [Level] {
        match self {
            Self::Dashboard => &[Level::View],
            Self::InviteAdmins => &[Level::Manage],
            _ => &[Level::View, Level::Manage],
        }
    }

    pub fn highest(self) -> Level {
        self.levels().last().copied().unwrap_or(Level::View)
    }
}

/// Areas with their levels, in the fixed order; an area left out is Off.
pub type Access = Vec<(Area, Level)>;

pub const UNKNOWN: &str = "Choose only areas from the list.";
pub const LEVEL: &str = "Choose a level this area allows.";
pub const EMPTY: &str = "Give at least one area.";

/// An `{area: level}` map from a request, checked against the fixed table: at least one
/// area, none unknown, each at a level it allows.
pub fn checked(map: &BTreeMap<String, String>) -> Result<Access, &'static str> {
    let mut access = Vec::new();
    for (key, level) in map {
        let area = Area::parse(key).ok_or(UNKNOWN)?;
        let level = Level::parse(level).filter(|level| area.levels().contains(level));
        access.push((area, level.ok_or(LEVEL)?));
    }
    if access.is_empty() {
        return Err(EMPTY);
    }
    access.sort_by_key(|(area, _)| ALL.iter().position(|known| known == area));
    Ok(access)
}

/// Saved access, read leniently: anything outside the table is ignored.
pub fn stored(value: &serde_json::Value) -> Access {
    ALL.into_iter()
        .filter_map(|area| {
            let level = value.get(area.key())?.as_str().and_then(Level::parse)?;
            area.levels().contains(&level).then_some((area, level))
        })
        .collect()
}

/// What this account may use, from its live identity row.
pub fn granted(user: &UserRow) -> Access {
    match user.role.as_str() {
        "super-admin" => ALL.into_iter().map(|area| (area, area.highest())).collect(),
        "platform" => user
            .platform_access
            .as_ref()
            .map(|saved| stored(&saved.0))
            .unwrap_or_default(),
        _ => Vec::new(),
    }
}

/// Whether the account holds `area` at `level` or higher.
pub fn allows(user: &UserRow, area: Area, level: Level) -> bool {
    granted(user)
        .into_iter()
        .any(|(held, at)| held == area && at >= level)
}

/// The `{area: level}` shape the API and the profile use.
pub fn to_map(access: &Access) -> BTreeMap<&'static str, &'static str> {
    access
        .iter()
        .map(|(area, level)| (area.key(), level.key()))
        .collect()
}

#[cfg(test)]
#[path = "areas_tests.rs"]
mod tests;
