//! Putting reserved backfill files into storage and proving they arrived (security review
//! M1): the record's inline copy is replaced only after each object has been read back from
//! the configured bucket and matches its reserved SHA-256. All of one record's files must
//! be stored within [`DEADLINE`]; the sweep keeps the objects of unconfirmed backfill rows
//! for an hour (`sweep.rs`), so a put still landing after its row was hidden is removed
//! later instead of being left untracked (review L1).
use super::Prepared;
use crate::{
    config::media_settings::MediaConfig,
    media::{s3, sigv4::sha256_hex},
};
use std::time::Duration;

/// Longest time one record's puts and read-backs may take; well inside the sweep's hour.
pub const DEADLINE: Duration = Duration::from_secs(30 * 60);

/// Stores each `(storage key, file)` in order; false at the first failure, mismatch or when
/// the deadline passes. The caller then hides the reserved rows.
pub async fn store_all(config: &MediaConfig, files: Vec<(String, Prepared)>) -> bool {
    let work = async {
        for (key, file) in files {
            if !store_verified(config, &key, file).await {
                return false;
            }
        }
        true
    };
    tokio::time::timeout(DEADLINE, work).await.unwrap_or(false)
}

async fn store_verified(config: &MediaConfig, key: &str, file: Prepared) -> bool {
    let (kind, expected) = (file.kind, file.sha256);
    if s3::put_creating(config, key, file.bytes, kind.content_type())
        .await
        .is_err()
    {
        return false;
    }
    match s3::get(config, key, kind.max_bytes()).await {
        Ok(stored) => sha256_hex(&stored) == expected,
        Err(_) => false,
    }
}
