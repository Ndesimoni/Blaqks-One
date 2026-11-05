//! `media-backfill` (docs/media-storage.md, "F2 backfill as built"): the trusted operator's
//! command that moves property photos and floor plans saved inline before packet F2 (data
//! URLs inside the record JSON) into private storage. A dry run by default; `--apply` moves
//! them one record at a time, each in its own transaction with its version check. Only the
//! two media fields of `Properties` records change; anything that cannot move stays inline,
//! exactly as it was, and is reported. Running it again changes nothing.
pub mod apply;
pub mod inline;
pub mod options;
pub mod plan;
pub mod report;
pub mod rewrite;
pub mod store;
pub mod workspace;

pub use options::Options;

use crate::{config::media_settings::MediaConfig, error::ApiError};
use report::{emit, Header, Storage, Workspace};
use sqlx::PgPool;
use std::io::Write;

const UNCONFIGURED: &str =
    "File storage is not set up: set CRM_MEDIA_* before running media-backfill --apply.";

fn stopped(_: ApiError) -> String {
    "The media backfill stopped: the database refused or lost the connection. Records already \
     moved stay moved; run the command again to continue."
        .into()
}

/// Runs the command on a migrated database, writing the report to `out` line by line.
pub async fn run(
    pool: &PgPool,
    media: Option<&MediaConfig>,
    options: Options,
    out: &mut impl Write,
) -> Result<(), String> {
    let config = match (options.apply, media) {
        (false, _) => None,
        (true, Some(config)) => Some(config),
        (true, None) => return Err(UNCONFIGURED.into()),
    };
    let header = Header {
        mode: if options.apply { "apply" } else { "dry-run" },
        storage: media.map(Storage::of),
    };
    emit(out, &header)?;
    let workspaces = match options.workspace {
        Some(id) => vec![id],
        None => store::workspaces(pool).await.map_err(stopped)?,
    };
    for id in workspaces {
        let mut report = Workspace::new(&id);
        match workspace::run(pool, config, &mut report).await {
            Ok(()) => emit(out, &report)?,
            // `owner_of` refuses a workspace that does not exist, before anything is done.
            Err(error) if error.2 == "forbidden" => {
                return Err(format!("No workspace has the ID {id}."))
            }
            Err(error) => {
                report.stopped = true;
                emit(out, &report)?;
                return Err(stopped(error));
            }
        }
    }
    Ok(())
}
