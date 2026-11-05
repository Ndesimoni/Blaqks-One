//! Shared outbox test fixtures (a scripted fake domain) and pure unit tests.
use super::model::{Domain, Job, Outcome, SendFuture, CALL_TIMEOUT, LEASE_SECONDS};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Mutex,
};

/// A domain that answers with scripted outcomes and counts every provider call.
pub struct Scripted {
    pub calls: AtomicUsize,
    pub outcomes: Mutex<Vec<Outcome>>,
}

impl Scripted {
    pub fn new(outcomes: Vec<Outcome>) -> Self {
        Self {
            calls: AtomicUsize::new(0),
            outcomes: Mutex::new(outcomes),
        }
    }

    pub fn calls(&self) -> usize {
        self.calls.load(Ordering::SeqCst)
    }
}

impl Domain for Scripted {
    fn name(&self) -> &'static str {
        "inbox"
    }

    fn send<'a>(&'a self, _job: &'a Job) -> SendFuture<'a> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        let next = self.outcomes.lock().unwrap().remove(0);
        Box::pin(async move { next })
    }
}

#[test]
fn every_call_ends_well_inside_its_lease() {
    assert!(CALL_TIMEOUT.as_secs() * 2 <= LEASE_SECONDS as u64);
}

#[test]
fn attempt_outcomes_use_the_stored_words() {
    let retry = Outcome::Retry {
        after: None,
        code: "rate_limited",
    };
    assert_eq!(Outcome::Sent.label(), "sent");
    assert_eq!(retry.label(), "retry");
    assert_eq!(Outcome::Failed { code: "refused" }.label(), "failed");
    assert_eq!(Outcome::Unknown { code: "timeout" }.label(), "unknown");
}
