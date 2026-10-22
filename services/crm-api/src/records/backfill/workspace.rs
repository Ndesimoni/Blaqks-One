//! One workspace: each property record with inline media, one at a time, planned against
//! the company's storage headroom and (with `--apply`) moved in its own transaction.
use super::{
    apply::{self, Outcome, Target},
    plan::plan,
    report::{Left, Workspace},
    store,
};
use crate::{
    config::media_settings::MediaConfig,
    error::ApiResult,
    media::{backfill as media, upload::COMPANY_BYTES},
    workspaces,
};
use sqlx::PgPool;

/// `config` is `Some` only with `--apply`.
pub async fn run(
    pool: &PgPool,
    config: Option<&MediaConfig>,
    workspace: &str,
) -> ApiResult<Workspace> {
    let mut report = Workspace::new(workspace);
    let (uploader, frozen) = {
        let mut tx = pool.begin().await?;
        let owner = workspaces::owner_of(&mut tx, workspace).await?;
        (owner, workspaces::frozen(&mut tx, workspace).await?)
    };
    if frozen {
        report.archived = true;
        return Ok(report);
    }
    let mut headroom = COMPANY_BYTES - media::used(pool, workspace).await?;
    for id in store::candidates(pool, workspace).await? {
        let Some(record) = store::load(pool, workspace, id).await? else {
            continue;
        };
        let plan = plan(&record.fields(), &mut headroom);
        report
            .left
            .extend(plan.left.iter().map(|&(field, index, reason)| Left {
                record: id,
                field,
                index,
                reason,
            }));
        if plan.moves.is_empty() {
            continue;
        }
        let (entries, bytes) = (plan.moves.len(), plan.bytes());
        let Some(config) = config else {
            report.moved(entries, bytes);
            continue;
        };
        let target = Target {
            pool,
            config,
            workspace,
            uploader,
        };
        match apply::apply(&target, &record, plan).await? {
            Outcome::Moved => {
                report.moved(entries, bytes);
                continue;
            }
            Outcome::ChangedMeanwhile => report.changed_meanwhile.push(id),
            Outcome::Failed => report.failed.push(id),
            Outcome::Frozen => {
                report.archived = true;
                break;
            }
        }
        // Nothing of this record was kept, so its space is free again.
        headroom += bytes;
    }
    Ok(report)
}
