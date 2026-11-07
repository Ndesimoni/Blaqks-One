//! Files moved out of record JSON by the trusted `media-backfill` command (docs/media-storage.md,
//! "F2 backfill as built"). Bytes are checked and cleaned exactly like uploads. Rows are
//! reserved first (attached to their owner, not yet stored, origin `backfill`) and committed
//! before any bytes are put (`rows`); each object is read back and compared with its reserved
//! fingerprint (`objects`); only the owner's own transaction marks the rows stored. A failed
//! or skipped commit therefore leaves nothing visible, and the sweep removes whatever reached
//! storage. Media still never learns what the owner is or what its record says.
pub mod objects;
pub mod rows;

pub use objects::{store_all, DEADLINE};
pub use rows::{confirm, discard, reserve, used, within_cap};

use super::{
    naming::{plain_name, typed_name},
    sigv4::sha256_hex,
    sniff::{clean, detect, Kind},
};

/// Why a file cannot be stored; the owning module leaves it where it was.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Refusal {
    /// Not a JPEG, PNG, WebP or PDF by its first bytes.
    Unsupported,
    /// Over 10 MB (photos) or 20 MB (PDFs), as for uploads.
    TooLarge,
    /// The type is known but the file is malformed, so metadata cannot be removed.
    Unreadable,
}

/// A file ready to store: its real type, metadata removed, display name typed, and the
/// SHA-256 of the cleaned bytes that the stored object must match.
pub struct Prepared {
    pub name: String,
    pub kind: Kind,
    pub bytes: Vec<u8>,
    pub sha256: String,
}

pub fn prepare(name: &str, bytes: &[u8]) -> Result<Prepared, Refusal> {
    let kind = detect(bytes).ok_or(Refusal::Unsupported)?;
    if bytes.len() > kind.max_bytes() {
        return Err(Refusal::TooLarge);
    }
    let bytes = clean(kind, bytes).map_err(|_| Refusal::Unreadable)?;
    Ok(Prepared {
        name: typed_name(&plain_name(name), kind.content_type()),
        kind,
        sha256: sha256_hex(&bytes),
        bytes,
    })
}
