//! The operator's report, printed once as JSON. It names workspaces and record UUIDs only:
//! never file names, bytes, data URLs or any other record content.
use super::inline::Reason;
use serde::Serialize;
use uuid::Uuid;

#[derive(Serialize)]
pub struct Report {
    /// `dry-run` (nothing changed) or `apply`.
    pub mode: &'static str,
    pub workspaces: Vec<Workspace>,
}

#[derive(Serialize)]
pub struct Workspace {
    pub workspace: String,
    /// Archived (frozen) workspaces are never changed.
    pub archived: bool,
    /// Records that moved (or would move) at least one entry.
    pub records: usize,
    /// Entries moved (or that would move), and their stored bytes after cleaning.
    pub entries: usize,
    pub bytes: i64,
    /// `--apply` only: skipped because the record changed after it was read.
    pub changed_meanwhile: Vec<Uuid>,
    /// `--apply` only: skipped because storage failed; run again later.
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
            archived: false,
            records: 0,
            entries: 0,
            bytes: 0,
            changed_meanwhile: Vec::new(),
            failed: Vec::new(),
            left: Vec::new(),
        }
    }

    pub fn moved(&mut self, entries: usize, bytes: i64) {
        self.records += 1;
        self.entries += entries;
        self.bytes += bytes;
    }
}

impl Report {
    pub fn json(&self) -> String {
        serde_json::to_string_pretty(self).unwrap_or_else(|_| "{}".into())
    }
}
