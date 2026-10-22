//! One workspace: each property record with inline media, one at a time, planned against
//! the company's storage headroom, rewritten and validated before anything is stored, and
//! (with `--apply`) moved in its own transaction. Results go into `report` as they happen,
//! so the caller can print them even when a database error stops the run.
use super::{
    apply::{self, Outcome, Target},
    inline::Reason,
    plan::plan,
    report::Workspace,
    rewrite::rewrite,
    store,
};
use crate::{
    config::media_settings::MediaConfig,
    error::ApiResult,
    media::{backfill as media, upload::COMPANY_BYTES},
    workspaces,
};
use sqlx::PgPool;
use uuid::Uuid;

/// `config` is `Some` only with `--apply`.
pub async fn run(
    pool: &PgPool,
    config: Option<&MediaConfig>,
    report: &mut Workspace,
) -> ApiResult<()> {
    let workspace = report.workspace.clone();
    let (uploader, frozen) = {
        let mut tx = pool.begin().await?;
        let owner = workspaces::owner_of(&mut tx, &workspace).await?;
        (owner, workspaces::frozen(&mut tx, &workspace).await?)
    };
    if frozen {
        report.archived = true;
        return Ok(());
    }
    let mut headroom = COMPANY_BYTES - media::used(pool, &workspace).await?;
    for id in store::candidates(pool, &workspace).await? {
        let Some(record) = store::load(pool, &workspace, id).await? else {
            continue;
        };
        let plan = plan(&record.fields(), &mut headroom);
        for &(field, index, reason) in &plan.left {
            report.leave(id, field, index, reason);
        }
        if plan.moves.is_empty() {
            continue;
        }
        let (entries, bytes) = (plan.moves.len(), plan.bytes());
        let moves: Vec<_> = plan.moves.iter().map(|m| (m.field, m.index)).collect();
        let Some(rewrite) = rewrite(&record, &plan) else {
            leave_all(report, id, &moves, Reason::Invalid);
            headroom += bytes;
            continue;
        };
        let Some(config) = config else {
            report.moved(entries, bytes);
            continue;
        };
        let target = Target {
            pool,
            config,
            workspace: &workspace,
            uploader,
        };
        match apply::apply(&target, &record, plan, rewrite).await? {
            Outcome::Moved => {
                report.moved(entries, bytes);
                continue;
            }
            Outcome::ChangedMeanwhile => report.changed_meanwhile.push(id),
            Outcome::Failed => report.failed.push(id),
            Outcome::OverQuota => leave_all(report, id, &moves, Reason::OverQuota),
            Outcome::Frozen => {
                report.archived = true;
                break;
            }
        }
        // Nothing of this record was kept, so its space is free again.
        headroom += bytes;
    }
    Ok(())
}

/// Every entry that was to move stays inline, for one reason.
fn leave_all(report: &mut Workspace, record: Uuid, moves: &[(&'static str, usize)], why: Reason) {
    for &(field, index) in moves {
        report.leave(record, field, index, why);
    }
}
