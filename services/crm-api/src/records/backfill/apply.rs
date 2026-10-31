//! `--apply` for one record: reserve its files under the IDs the rewrite chose (committed),
//! store and read back their bytes, then replace the media fields and confirm the files in
//! the record's own transaction with its version check. If storage fails, the record
//! changed, the workspace froze or the cap is reached, nothing in the record changes and the
//! reserved files are hidden at once (or, if even that fails, by the sweep).
use super::{
    plan::Plan,
    rewrite::Rewrite,
    store::{self, Committed, Current},
};
use crate::{
    config::media_settings::MediaConfig, error::ApiResult, media::backfill as media,
    records::media_links::KIND,
};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, PartialEq, Eq)]
pub enum Outcome {
    Moved,
    ChangedMeanwhile,
    Failed,
    Frozen,
    OverQuota,
}

pub struct Target<'a> {
    pub pool: &'a PgPool,
    pub config: &'a MediaConfig,
    pub workspace: &'a str,
    /// The workspace owner, recorded as the files' uploader (as for inbound mail).
    pub uploader: Uuid,
}

pub async fn apply(
    target: &Target<'_>,
    record: &Current,
    plan: Plan,
    rewrite: Rewrite,
) -> ApiResult<Outcome> {
    let Rewrite { fields, ids } = rewrite;
    let moving = plan.moves.iter().map(|item| &item.file);
    let files: Vec<_> = ids.iter().copied().zip(moving).collect();
    let (pool, workspace) = (target.pool, target.workspace);
    let keys = media::reserve(pool, workspace, target.uploader, (KIND, record.id), &files).await?;
    let objects = keys
        .into_iter()
        .zip(plan.moves.into_iter().map(|item| item.file));
    if !media::store_all(target.config, objects.collect()).await {
        media::discard(pool, &ids).await?;
        return Ok(Outcome::Failed);
    }
    let outcome = match store::commit(pool, workspace, record, &fields, &ids).await {
        Ok(Committed::Done) => return Ok(Outcome::Moved),
        Ok(Committed::Stale) => Outcome::ChangedMeanwhile,
        Ok(Committed::Frozen) => Outcome::Frozen,
        Ok(Committed::OverQuota) => Outcome::OverQuota,
        Err(error) => {
            // Best effort; the sweep hides anything left unconfirmed after an hour.
            let _ = media::discard(pool, &ids).await;
            return Err(error);
        }
    };
    media::discard(pool, &ids).await?;
    Ok(outcome)
}

#[cfg(test)]
#[path = "apply_tests.rs"]
mod tests;
