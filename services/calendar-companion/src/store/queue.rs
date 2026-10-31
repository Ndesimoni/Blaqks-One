use super::{random_id, Event, Session};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Serialize, Deserialize)]
pub struct Job {
    pub key: String,
    pub calendar_id: String,
    pub google_id: String,
    pub desired: Option<Event>,
    pub synced: Option<Event>,
    pub remote_exists: bool,
    pub url: Option<String>,
    pub error: Option<String>,
    pub attempts: u32,
    pub retry_at: i64,
}
impl Job {
    pub fn pending(&self) -> bool {
        self.desired != self.synced || (self.desired.is_none() && self.remote_exists)
    }
    pub fn status(&self) -> &'static str {
        if self.error.is_some() && self.pending() {
            "failed"
        } else if self.pending() {
            "pending"
        } else if self.remote_exists {
            "synced"
        } else {
            "cancelled"
        }
    }
}
pub fn queue_snapshot(session: &mut Session, events: Vec<Event>) {
    let calendar = session.calendar.as_ref().unwrap().id.clone();
    let desired: BTreeMap<_, _> = events.into_iter().map(|e| (e.key.clone(), e)).collect();
    for job in session
        .jobs
        .values_mut()
        .filter(|j| j.calendar_id == calendar)
    {
        let next = desired.get(&job.key).cloned();
        if job.desired != next {
            job.error = None;
            job.attempts = 0;
            job.retry_at = 0;
        }
        job.desired = next;
    }
    for (key, event) in desired {
        session
            .jobs
            .entry(format!("{calendar}\u{1f}{key}"))
            .or_insert_with(|| Job {
                key,
                calendar_id: calendar.clone(),
                google_id: random_id(),
                desired: Some(event),
                synced: None,
                remote_exists: false,
                url: None,
                error: None,
                attempts: 0,
                retry_at: 0,
            });
    }
}
