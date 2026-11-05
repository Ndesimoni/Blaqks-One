//! Unit tests for the marketplace's pure rules: the state winner and the three-day wait.
use super::{
    eligibility::{Checklist, MIN_AGE_DAYS, MIN_PROPERTIES},
    state::{can_apply_from, state, wait_over, Latest, State},
};
use crate::{records::market_activity::Counts, workspaces::company::Age};
use time::{Date, Month};

fn latest(pending: bool, decision: Option<&str>, applied: bool) -> Latest {
    Latest {
        application_id: None,
        applied,
        pending,
        decision: decision.map(str::to_owned),
        reason: None,
        decided_at: None,
    }
}

#[test]
fn a_newer_application_wins_over_the_latest_decision() {
    assert_eq!(state(&latest(false, None, false)), State::NotApplied);
    assert_eq!(state(&latest(true, Some("approved"), true)), State::Pending);
    assert_eq!(
        state(&latest(false, Some("approved"), true)),
        State::Approved
    );
    assert_eq!(
        state(&latest(false, Some("declined"), true)),
        State::Declined
    );
    assert_eq!(
        state(&latest(false, Some("revoked"), false)),
        State::Revoked
    );
}

#[test]
fn a_declined_company_waits_three_days() {
    let stamp = "2026-10-24T10:00:00.000Z";
    assert_eq!(
        can_apply_from(Some(stamp)).as_deref(),
        Some("2026-10-27T10:00:00Z")
    );
    assert_eq!(can_apply_from(None), None);
    let day = |day: u8, hour: u8| {
        Date::from_calendar_date(2026, Month::October, day)
            .expect("date")
            .with_hms(hour, 0, 0)
            .expect("time")
            .assume_utc()
    };
    assert!(!wait_over(Some(stamp), day(26, 9)));
    assert!(wait_over(Some(stamp), day(27, 10)));
    assert!(wait_over(None, day(24, 9)));
}

#[test]
fn the_checklist_needs_every_line() {
    let age = Age {
        age_days: MIN_AGE_DAYS,
        created_at: String::new(),
    };
    let counts = Counts {
        properties: MIN_PROPERTIES,
        clients: 5,
        contacts: 3,
        follow_ups: 3,
        viewings: 1,
        recent: true,
    };
    assert!(Checklist::of(&age, counts).met);
    let young = Age {
        age_days: MIN_AGE_DAYS - 1,
        created_at: String::new(),
    };
    assert!(!Checklist::of(&young, counts).met);
    let quiet = Counts {
        recent: false,
        ..counts
    };
    assert!(!Checklist::of(&age, quiet).met);
    let thin = Counts {
        properties: MIN_PROPERTIES - 1,
        ..counts
    };
    assert!(!Checklist::of(&age, thin).met);
}
