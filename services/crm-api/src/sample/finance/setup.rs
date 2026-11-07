//! Finance settings and commission agreements, through the finance owners' writes
//! (`settings_store::write`, `agreements_store::create_in`) with their events. A
//! workspace's own settings and agreements are never changed: they are kept and noted.
use super::{
    super::{dates::Calendar, failed, Outcome},
    people::People,
    present::{self, Tally},
    specs::{self, AGREEMENTS},
    Seeded,
};
use crate::finance::{agreements::NewAgreement, agreements_store, settings_store};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

pub async fn settings(
    tx: &mut Tx<'_>,
    workspace: &str,
    admin: Uuid,
    seeded: &mut Seeded,
) -> Outcome<()> {
    let mut tally = Tally::default();
    match settings_store::load(tx, workspace, true)
        .await
        .map_err(failed)?
    {
        Some(row) if present::marked(tx, "settings", row.id).await? => tally.present += 1,
        Some(_) => {
            tally.skipped += 1;
            seeded.note("Your finance settings were kept; the sample deals use them.");
        }
        None => {
            let row = settings_store::write(tx, admin, workspace, specs::settings())
                .await
                .map_err(failed)?;
            present::mark(tx, "settings", row.id, workspace).await?;
            tally.added += 1;
        }
    }
    seeded.rows.push(("Finance settings", tally));
    Ok(())
}

pub async fn agreements(
    tx: &mut Tx<'_>,
    workspace: &str,
    people: &People,
    calendar: &Calendar,
    seeded: &mut Seeded,
) -> Outcome<()> {
    let mut tally = Tally::default();
    for (who, share, starts) in AGREEMENTS {
        let Some(agent) = people.active(who) else {
            tally.skipped += 1;
            continue;
        };
        let (sample, any): (bool, bool) = sqlx::query_as(
            "SELECT COALESCE(bool_or(m.entity_id IS NOT NULL),false),count(a.id)>0 \
             FROM crm_commission_agreements a LEFT JOIN crm_sample_finance m \
             ON m.entity='agreement' AND m.entity_id=a.id WHERE a.workspace_id=$1 AND a.agent_id=$2",
        )
        .bind(workspace)
        .bind(agent)
        .fetch_one(&mut **tx)
        .await
        .map_err(failed)?;
        if sample {
            tally.present += 1;
            continue;
        }
        if any {
            tally.skipped += 1;
            seeded.note(&format!(
                "{who:?}'s own commission agreements were kept; no sample agreement was added."
            ));
            continue;
        }
        let input = NewAgreement {
            agent_id: agent,
            agent_share_bp: share,
            effective_from: calendar.day(starts),
        };
        match agreements_store::create_in(tx, people.admin, workspace, input).await {
            Ok((row, _)) => {
                present::mark(tx, "agreement", row.id, workspace).await?;
                tally.added += 1;
            }
            // Refused before writing, for example when it would cover earned deals.
            Err(error) if error.0.is_client_error() => {
                tally.skipped += 1;
                seeded.note(&format!(
                    "{who:?}'s sample agreement was skipped: {}",
                    error.1
                ));
            }
            Err(error) => return Err(failed(error)),
        }
    }
    seeded.rows.push(("Agreements", tally));
    Ok(())
}
