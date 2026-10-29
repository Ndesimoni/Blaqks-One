//! Private file storage (docs/media-storage.md, packet F1): an S3-compatible bucket behind
//! the API. This module stores, serves and removes files; owning modules attach them to
//! their own items and check access before serving (service boundaries rule 9).
pub mod backfill;
pub mod contents;
pub mod copies;
pub mod copy_bytes;
pub mod copy_reuse;
pub mod dimensions;
pub mod inbound;
pub mod inbound_store;
mod jpeg;
pub mod naming;
pub mod neutral;
pub mod owned;
pub mod public_assets;
mod request;
pub mod routes;
pub mod s3;
pub mod serve;
pub mod sigv4;
pub mod sniff;
pub mod store;
pub mod sweep;
pub mod upload;
mod webp;
