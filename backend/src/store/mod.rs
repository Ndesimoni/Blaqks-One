use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use chrono::{DateTime, NaiveDate};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
};

pub fn now() -> i64 {
    chrono::Utc::now().timestamp()
}
pub fn random_id() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Store {
    pub sessions: BTreeMap<String, Session>,
}
#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Session {
    pub csrf: String,
    pub oauth: Option<OAuthState>,
    pub tokens: Option<Tokens>,
    pub calendar: Option<Calendar>,
    pub jobs: BTreeMap<String, Job>,
    pub connection_error: Option<String>,
    #[serde(default)]
    pub snapshot_revision: i64,
    #[serde(default)]
    pub ready: bool,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct OAuthState {
    pub state: String,
    pub verifier: String,
    pub expires: i64,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Tokens {
    pub access: String,
    pub refresh: String,
    pub expires: i64,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Calendar {
    pub id: String,
    pub summary: String,
}

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

#[derive(Clone)]
pub struct Vault {
    pub path: PathBuf,
    pub key: Option<[u8; 32]>,
}
impl Vault {
    pub fn new(path: PathBuf, key: &str) -> Result<Self, String> {
        let key = if key.is_empty() {
            None
        } else {
            if key.len() != 64 || !key.bytes().all(|b| b.is_ascii_hexdigit()) {
                return Err(
                    "CALENDAR_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters".into(),
                );
            }
            let mut bytes = [0; 32];
            for (i, byte) in bytes.iter_mut().enumerate() {
                *byte = u8::from_str_radix(&key[i * 2..i * 2 + 2], 16).unwrap();
            }
            Some(bytes)
        };
        Ok(Self { path, key })
    }
    pub fn load(&self) -> Result<Store, String> {
        if !self.path.exists() {
            return Ok(Store::default());
        }
        let raw = fs::read(&self.path).map_err(|_| "Calendar store could not be read")?;
        let key = self
            .key
            .ok_or("The existing calendar store requires its original encryption key")?;
        if raw.len() < 32 || &raw[..4] != b"KWS1" {
            return Err("Calendar store is invalid; preserve it for recovery".into());
        }
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        let plain = cipher
            .decrypt(Nonce::from_slice(&raw[4..16]), &raw[16..])
            .map_err(|_| "Calendar store could not be decrypted; check its encryption key")?;
        serde_json::from_slice(&plain).map_err(|_| "Calendar store contents are invalid".into())
    }
    pub fn save(&self, store: &Store) -> Result<(), String> {
        let Some(key) = self.key else {
            return Ok(());
        };
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        let mut nonce = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce);
        let plain = serde_json::to_vec(store).map_err(|_| "Calendar store could not be encoded")?;
        let encrypted = cipher
            .encrypt(Nonce::from_slice(&nonce), plain.as_ref())
            .map_err(|_| "Calendar store encryption failed")?;
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)
                .map_err(|_| "Calendar storage directory could not be created")?;
        }
        let temporary = self.path.with_extension("tmp");
        let mut options = OpenOptions::new();
        options.create(true).truncate(true).write(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&temporary)
            .map_err(|_| "Calendar store could not be written")?;
        file.write_all(b"KWS1")
            .and_then(|_| file.write_all(&nonce))
            .and_then(|_| file.write_all(&encrypted))
            .and_then(|_| file.sync_all())
            .map_err(|_| "Calendar store write failed")?;
        fs::rename(temporary, &self.path).map_err(|_| "Calendar store could not be committed")?;
        Ok(())
    }
}
