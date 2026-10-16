//! Fictional finance samples (finance-design §18, B6) for an Admin's team workspace:
//! settings when the team has none, agreements for Layla and Karim, six deals across
//! states, and payments and expenses in every approval state. Every row goes through the
//! finance owners' write functions inside the seed's transaction, so snapshots, events,
//! activity (source `sample`, actor the Admin) and database guards match the app's.
pub mod clear;
pub mod deals;
pub mod entries;
pub mod ledger;
pub mod people;
pub mod present;
pub mod safety;
pub mod setup;
pub mod specs;
pub mod steps;

use super::{dates::Calendar, failed, target::Target, Outcome};
use crate::{
    finance::deals::gate::{self, Need},
    workspaces::ORGANISATION,
};
use people::People;
use present::Tally;
use sqlx::{Postgres, Transaction};

/// `(kind, tally)` in seeding order, and notes about anything kept or skipped.
#[derive(Default)]
pub struct Seeded {
    pub rows: Vec<(&'static str, Tally)>,
    pub notes: Vec<String>,
}

impl Seeded {
    pub fn note(&mut self, text: &str) {
        self.notes.push(text.to_owned());
    }
}

/// The interaction log entry that links to the sample estimate.
const LINKED_LOG: (&str, &str) = ("LG-S01", "DL-S01");

/// Call after the sample records and staff, under the workspace lock with the sample
/// source set. The organisation workspace has no finance writer, so it gets none.
pub async fn seed(
    tx: &mut Transaction<'_, Postgres>,
    target: &Target,
    calendar: &Calendar,
) -> Outcome<Seeded> {
    let mut seeded = Seeded::default();
    if target.workspace == ORGANISATION {
        seeded.note("Finance samples are added to Admin team workspaces only.");
        return Ok(seeded);
    }
    let workspace = target.workspace.as_str();
    let admin = gate::relock(tx, workspace, target.owner, Need::Manage)
        .await
        .map_err(failed)?;
    let people = People::resolve(tx, target).await?;
    setup::settings(tx, workspace, admin.id, &mut seeded).await?;
    setup::agreements(tx, workspace, &people, calendar, &mut seeded).await?;
    let created = deals::seed(tx, &admin, &people, calendar, &mut seeded).await?;
    if let Some(deal) = created.get(LINKED_LOG.1) {
        link_log(tx, workspace, *deal).await?;
    }
    entries::seed(tx, &admin, &people, &created, calendar, &mut seeded).await?;
    Ok(seeded)
}

/// Links the unchanged sample log to the new sample deal, as part of its insertion (the
/// import path never binds deal links): the payload ID and `deal_ref` together (0016).
async fn link_log(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    deal: uuid::Uuid,
) -> Outcome<()> {
    sqlx::query(
        "UPDATE crm_records r SET deal_ref=d.legacy_id, \
         payload=r.payload||jsonb_build_object('deal_id_optional',d.legacy_id) \
         FROM crm_deals d WHERE d.id=$3 AND d.workspace_id=$1 AND r.workspace_id=$1 \
         AND r.collection='Interaction log' AND r.legacy_id=$2 AND r.version=1 \
         AND r.deal_ref IS NULL AND COALESCE(r.payload->>'deal_id_optional','')='' \
         AND EXISTS (SELECT 1 FROM crm_sample_records m WHERE m.record_id=r.id)",
    )
    .bind(workspace)
    .bind(LINKED_LOG.0)
    .bind(deal)
    .execute(&mut **tx)
    .await
    .map_err(failed)?;
    Ok(())
}

#[cfg(test)]
mod tests;
