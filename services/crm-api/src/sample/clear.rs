//! `clear-sample`: removes only rows marked in `crm_sample_records`, children before
//! parents, in one transaction under the workspace lock, with a `deleted` activity row
//! (source `sample`) for each. Records people created are never removed; when one links
//! to a sample record the clear is refused. Sample records changed in the app are kept
//! unless `--include-edited` is passed. Sample staff are suspended, not archived. Sample
//! finance goes after the child records and before the clients and properties it links.
use super::{
    failed, finance, mark_source,
    safety::{self, EDITED, LINKED},
    target::Target,
    target::UNCHANGED,
    Outcome,
};
use crate::{
    assignments::departure,
    media,
    records::{collections::COLLECTIONS, media_links, visibility::ASSIGNABLE},
    team::audit,
    workspaces,
};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

/// Records sample finance links to; it is removed before the first of them.
const PARENTS: [&str; 3] = ["Contacts", "Clients", "Properties"];

pub struct Cleared {
    /// `(collection, removed)` in deletion order.
    pub counts: Vec<(&'static str, i64)>,
    pub finance: Option<finance::clear::Cleared>,
    pub suspended: u64,
}

pub async fn clear(pool: &PgPool, target: &Target, include_edited: bool) -> Outcome<Cleared> {
    let mut tx = pool.begin().await.map_err(failed)?;
    let workspace = target.workspace.as_str();
    workspaces::lock(&mut tx, workspace).await.map_err(failed)?;
    workspaces::ensure_writable(&mut tx, workspace, target.owner, None, None)
        .await
        .map_err(|_| format!("The Admin or workspace is no longer active.{UNCHANGED}"))?;
    mark_source(&mut tx).await?;
    let mut linked = safety::find(&mut tx, LINKED, workspace).await?;
    linked.extend(safety::find(&mut tx, finance::safety::LINKED, workspace).await?);
    if !linked.is_empty() {
        return Err(safety::linked_message(&linked));
    }
    let mut edited = safety::find(&mut tx, EDITED, workspace).await?;
    edited.extend(safety::find(&mut tx, finance::safety::EDITED, workspace).await?);
    if !edited.is_empty() && !include_edited {
        return Err(safety::edited_message(&edited));
    }
    let (mut counts, mut finance) = (Vec::new(), None);
    for collection in COLLECTIONS.iter().rev().map(|collection| collection.name) {
        if finance.is_none() && PARENTS.contains(&collection) {
            finance = Some(finance::clear::clear(&mut tx, target).await?);
        }
        let removed: Vec<Uuid> = sqlx::query_scalar(
            "WITH gone AS (DELETE FROM crm_records r USING crm_sample_records m \
             WHERE m.record_id=r.id AND m.workspace_id=$1 AND r.workspace_id=$1 \
             AND r.collection=$2 RETURNING r.id), \
             logged AS (INSERT INTO crm_activity (id,actor_id,workspace_id,action,collection,\
             record_id) SELECT gen_random_uuid(),$3,$1,'deleted',$2,id FROM gone) \
             SELECT id FROM gone",
        )
        .bind(workspace)
        .bind(collection)
        .bind(target.owner)
        .fetch_all(&mut *tx)
        .await
        .map_err(failed)?;
        // Photos people added to sample properties go with them (packet F2).
        media::owned::remove_owners(&mut tx, workspace, media_links::KIND, &removed)
            .await
            .map_err(failed)?;
        counts.push((collection, removed.len() as i64));
    }
    let suspended = suspend(&mut tx, target).await?;
    tx.commit().await.map_err(failed)?;
    Ok(Cleared {
        counts,
        finance,
        suspended,
    })
}

/// Suspends this team's active sample members as the team page does: sessions end,
/// any records they still hold return to the Admin queue, and `suspended` is logged.
/// Only staff rows owned by the target Admin qualify, whatever the marker table says.
async fn suspend(tx: &mut Transaction<'_, Postgres>, target: &Target) -> Outcome<u64> {
    let ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT u.id FROM crm_users u JOIN crm_sample_accounts m ON m.user_id=u.id \
         WHERE m.workspace_id=$1 AND u.workspace_id=$1 AND u.role='staff' AND u.owner_id=$2 \
         AND u.active AND u.deleted_at IS NULL ORDER BY u.id FOR UPDATE OF u",
    )
    .bind(&target.workspace)
    .bind(target.owner)
    .fetch_all(&mut **tx)
    .await
    .map_err(failed)?;
    for id in &ids {
        sqlx::query(
            "UPDATE crm_users SET active=false,version=version+1 \
             WHERE id=$1 AND role='staff' AND owner_id=$2",
        )
        .bind(id)
        .bind(target.owner)
        .execute(&mut **tx)
        .await
        .map_err(failed)?;
        let workspace = &target.workspace;
        departure::release(tx, workspace, *id, &ASSIGNABLE, target.owner, "departure")
            .await
            .map_err(failed)?;
        // Their mailbox, address and WhatsApp number end too (W1a review L2).
        let leaving = crate::integrations::Leaving::ALL;
        crate::integrations::departure(tx, workspace, &[*id], leaving, target.owner)
            .await
            .map_err(failed)?;
        sqlx::query("DELETE FROM crm_sessions WHERE user_id=$1")
            .bind(id)
            .execute(&mut **tx)
            .await
            .map_err(failed)?;
        audit::append(tx, target.owner, workspace, *id, "suspended")
            .await
            .map_err(failed)?;
    }
    Ok(ids.len() as u64)
}
