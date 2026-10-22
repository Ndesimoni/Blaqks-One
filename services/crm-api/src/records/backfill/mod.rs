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
pub mod store;
pub mod workspace;

pub use options::Options;

use crate::{config::media_settings::MediaConfig, error::ApiError};
use report::Report;
use sqlx::PgPool;

const UNCONFIGURED: &str =
    "File storage is not set up: set CRM_MEDIA_* before running media-backfill --apply.";

fn stopped(_: ApiError) -> String {
    "The media backfill stopped: the database refused or lost the connection. Records already \
     moved stay moved; run the command again to continue."
        .into()
}

/// Runs the command on a migrated database and returns the report.
pub async fn run(
    pool: &PgPool,
    media: Option<&MediaConfig>,
    options: Options,
) -> Result<String, String> {
    let config = match (options.apply, media) {
        (false, _) => None,
        (true, Some(config)) => Some(config),
        (true, None) => return Err(UNCONFIGURED.into()),
    };
    let workspaces = match options.workspace {
        Some(id) => vec![id],
        None => store::workspaces(pool).await.map_err(stopped)?,
    };
    let mut report = Report {
        mode: if options.apply { "apply" } else { "dry-run" },
        workspaces: Vec::with_capacity(workspaces.len()),
    };
    for workspace in workspaces {
        match workspace::run(pool, config, &workspace).await {
            Ok(done) => report.workspaces.push(done),
            // `owner_of` refuses a workspace that does not exist.
            Err(error) if error.2 == "forbidden" => {
                return Err(format!("No workspace has the ID {workspace}."))
            }
            Err(error) => return Err(stopped(error)),
        }
    }
    Ok(report.json())
}
