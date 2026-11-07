use chrono::{DateTime, NaiveDate};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EventDate {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_zone: Option<String>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Attendee {
    pub email: String,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Event {
    pub key: String,
    pub summary: String,
    pub description: String,
    pub location: String,
    pub start: EventDate,
    pub end: EventDate,
    pub reminder_minutes: u32,
    pub attendees: Vec<Attendee>,
}
impl Event {
    pub fn validate(&self) -> bool {
        let date_ok = match (
            &self.start.date,
            &self.end.date,
            &self.start.date_time,
            &self.end.date_time,
        ) {
            (Some(s), Some(e), None, None) => match (
                NaiveDate::parse_from_str(s, "%Y-%m-%d"),
                NaiveDate::parse_from_str(e, "%Y-%m-%d"),
            ) {
                (Ok(s), Ok(e)) => e > s && (e - s).num_days() <= 1,
                _ => false,
            },
            (None, None, Some(s), Some(e)) => match (
                DateTime::parse_from_rfc3339(s),
                DateTime::parse_from_rfc3339(e),
            ) {
                (Ok(s), Ok(e)) => {
                    e > s
                        && (e - s).num_minutes() <= 1440
                        && self.start.time_zone.as_deref() == Some("Asia/Dubai")
                        && self.end.time_zone.as_deref() == Some("Asia/Dubai")
                }
                _ => false,
            },
            _ => false,
        };
        date_ok
            && (self.key.starts_with("Follow-ups:") || self.key.starts_with("Viewings:"))
            && self.key.len() <= 200
            && !self.summary.trim().is_empty()
            && self.summary.len() <= 2000
            && self.description.len() <= 8000
            && self.location.len() <= 4000
            && self.reminder_minutes <= 40320
            && self.attendees.len() <= 1
            && self.attendees.iter().all(|a| {
                a.email.len() <= 254
                    && a.email.contains('@')
                    && !a.email.chars().any(char::is_whitespace)
            })
    }
    pub fn google_body(&self) -> serde_json::Value {
        serde_json::json!({
            "summary": self.summary, "description": self.description, "location": self.location,
            "start": self.start, "end": self.end, "attendees": self.attendees,
            "status": "confirmed",
            "reminders": {"useDefault": false, "overrides": [{"method": "popup", "minutes": self.reminder_minutes}]},
            "extendedProperties": {"private": {"kwsRecord": self.key}},
        })
    }
}
