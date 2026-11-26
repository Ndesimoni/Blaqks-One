//! The operator's report as JSON lines: a header naming the mode and the storage target,
//! then one line per workspace written as soon as it finishes, also when the run stops on an
//! error (security review M2). It names workspace IDs, record UUIDs and the storage host and
//! bucket only: never credentials, file names, bytes, data URLs or other record content.
use super::inline::Reason;
use crate::config::media_settings::MediaConfig;
use serde::Serialize;
use std::io::Write;
use uuid::Uuid;

#[derive(Serialize)]
pub struct Header {
    /// `dry-run` (nothing changed) or `apply`.
    pub mode: &'static str,
    /// Where files go, so the operator can confirm the bucket before applying (review M1).
    pub storage: Option<Storage>,
}

#[derive(Serialize)]
pub struct Storage {
    pub host: String,
    pub bucket: String,
}

impl Storage {
    pub fn of(config: &MediaConfig) -> Self {
        let url = url::Url::parse(&config.endpoint).ok();
        let host = url.as_ref().and_then(|url| url.host_str()).unwrap_or("?");
        let host = match url.as_ref().and_then(url::Url::port) {
            Some(port) => format!("{host}:{port}"),
            None => host.to_owned(),
        };
        Self {
            host,
            bucket: config.bucket.clone(),
        }
    }
}

#[derive(Serialize, Default)]
pub struct Workspace {
    pub workspace: String,
    /// Archived (frozen) workspaces are never changed.
    pub archived: bool,
    /// The run stopped on an error while in this workspace; the counts are what was done.
    pub stopped: bool,
    /// Records that moved (or would move) at least one entry.
    pub records: usize,
    /// Entries moved (or that would move), and their stored bytes after cleaning.
    pub entries: usize,
    pub bytes: i64,
    /// `--apply` only: skipped because the record changed after it was read.
    pub changed_meanwhile: Vec<Uuid>,
    /// `--apply` only: skipped because storage failed or did not match; run again later.
    pub failed: Vec<Uuid>,
    /// Entries that stay inline, unchanged, and why.
    pub left: Vec<Left>,
}

#[derive(Serialize)]
pub struct Left {
    pub record: Uuid,
    pub field: &'static str,
    pub index: usize,
    pub reason: Reason,
}

impl Workspace {
    pub fn new(workspace: &str) -> Self {
        Self {
            workspace: workspace.to_owned(),
            ..Self::default()
        }
    }

    pub fn moved(&mut self, entries: usize, bytes: i64) {
        self.records += 1;
        self.entries += entries;
        self.bytes += bytes;
    }

    pub fn leave(&mut self, record: Uuid, field: &'static str, index: usize, reason: Reason) {
        self.left.push(Left {
            record,
            field,
            index,
            reason,
        });
    }
}

/// Writes one line and flushes it at once.
pub fn emit(out: &mut impl Write, value: &impl Serialize) -> Result<(), String> {
    let line = serde_json::to_string(value).map_err(|_| "The report could not be written.")?;
    writeln!(out, "{line}")
        .and_then(|_| out.flush())
        .map_err(|_| "The report could not be written.".to_owned())
}
