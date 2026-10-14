//! Clearly fictional sample data for a local development CRM: `seed-sample` fills an
//! Admin's workspace and `clear-sample` removes exactly what it added. Both refuse to
//! run outside the local configuration (`guard`) or on an unmarked database (`marker`),
//! confirm the destination, write through the import insertion path under the
//! workspace lock, and attribute activity to the workspace owner with source `sample`.
pub mod accounts;
pub mod clear;
pub mod confirm;
pub mod credentials;
pub mod data;
pub mod dates;
pub mod enrol;
pub mod existing;
pub mod guard;
pub mod marker;
pub mod options;
pub mod report;
pub mod safety;
pub mod seed;
pub mod staff;
pub mod target;

use crate::error::ApiError;
use options::{Command, Options};
use sqlx::{PgPool, Postgres, Transaction};

/// Operator-facing results; errors are complete terminal messages.
pub type Outcome<T> = Result<T, String>;

pub fn failed(error: impl Into<ApiError>) -> String {
    error.into().1.to_owned()
}

/// Every activity, team-activity and assignment-history row this transaction writes
/// gets `source = 'sample'` (the column default reads this transaction-local setting).
pub async fn mark_source(tx: &mut Transaction<'_, Postgres>) -> Outcome<()> {
    sqlx::query("SELECT set_config('kws.activity_source','sample',true)")
        .execute(&mut **tx)
        .await
        .map_err(failed)?;
    Ok(())
}

/// Runs a parsed command against a marked, migrated local database (`database` is its
/// `host:port/name`); returns the summary.
pub async fn run(pool: &PgPool, options: Options, database: &str) -> Outcome<String> {
    let target = target::resolve(pool, options.organisation).await?;
    confirm::confirm(&options, database, &target)?;
    match options.command {
        Command::Seed => {
            let seeded = seed::seed(pool, &target, options.staff).await?;
            Ok(report::seeded(&target, &seeded))
        }
        Command::Clear => {
            let cleared = clear::clear(pool, &target, options.include_edited).await?;
            Ok(report::cleared(&target, &cleared))
        }
    }
}
