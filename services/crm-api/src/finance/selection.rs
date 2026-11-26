//! Which share applies to a deal (finance-design §3.2 step 3, §3.6).

/// Where the primary agent's share came from (§3.2 step 3).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SplitSource {
    Override,
    Agreement,
    TeamDefault,
    Owner,
}

/// §3.2 step 3: override, then the agreement in force, then the team default; an
/// owner-held or queued deal has no agent share.
pub fn select_share(
    owner_held: bool,
    override_bp: Option<i32>,
    agreement_bp: Option<i32>,
    team_default_bp: i32,
) -> (Option<i32>, SplitSource) {
    match (owner_held, override_bp, agreement_bp) {
        (true, _, _) => (None, SplitSource::Owner),
        (false, Some(share), _) => (Some(share), SplitSource::Override),
        (false, None, Some(share)) => (Some(share), SplitSource::Agreement),
        (false, None, None) => (Some(team_default_bp), SplitSource::TeamDefault),
    }
}

/// An agreement in force on `on` (ISO dates): `from ≤ on < to`, or open-ended.
pub fn in_force(from: &str, to: Option<&str>, on: &str) -> bool {
    from <= on && to.is_none_or(|to| on < to)
}
