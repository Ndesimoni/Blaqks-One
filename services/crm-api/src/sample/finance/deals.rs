//! Sample deals through the deal owner's `create::insert`, then their `steps`. A deal whose holder or receiver cannot take part (not active, no finance module, or
//! no longer holding the client) is skipped whole.
use super::{
    super::{dates::Calendar, failed, Outcome},
    people::People,
    present::{self, Tally, DEALS},
    specs::{self, DealSpec, Step, Who},
    steps, Seeded,
};
use crate::{
    auth::profile::UserRow,
    finance::deals::{
        create,
        gate::{self, Need},
        input,
    },
};
use sqlx::{Postgres, Transaction};
use std::collections::HashMap;
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

/// Creates the missing sample deals; returns those created now, by sample ID.
pub async fn seed(
    tx: &mut Tx<'_>,
    admin: &UserRow,
    people: &People,
    calendar: &Calendar,
    seeded: &mut Seeded,
) -> Outcome<HashMap<&'static str, Uuid>> {
    let workspace = admin.workspace_id.as_str();
    let today = calendar.day(0);
    let (mut tally, mut created) = (Tally::default(), HashMap::new());
    for spec in specs::deals(calendar) {
        if present::present(tx, DEALS, workspace, spec.id).await? {
            tally.present += 1;
            continue;
        }
        if !ready(tx, workspace, people, &spec).await? {
            tally.skipped += 1;
            continue;
        }
        let deal = input::parse(&spec.deal, true).map_err(failed)?;
        let id = create::insert(tx, workspace, admin, &deal, spec.id)
            .await
            .map_err(failed)?;
        present::mark(tx, "deal", id, workspace).await?;
        for step in spec.steps {
            steps::apply(tx, admin, people, id, *step, (calendar, &today)).await?;
        }
        created.insert(spec.id, id);
        tally.added += 1;
    }
    seeded.rows.push(("Deals", tally));
    if tally.skipped > 0 {
        seeded.note("Deals for sample staff without the finance module were skipped.");
    }
    Ok(created)
}

/// The holder (and any receiver) can take part, and a staff holder still holds the client.
async fn ready(
    tx: &mut Tx<'_>,
    workspace: &str,
    people: &People,
    spec: &DealSpec,
) -> Outcome<bool> {
    let receivers = spec.steps.iter().filter_map(|step| match step {
        Step::Offer { to, .. } => Some(*to),
        _ => None,
    });
    if receivers
        .chain([spec.holder])
        .any(|who| people.finance(who).is_none())
    {
        return Ok(false);
    }
    if spec.holder == Who::Admin {
        return Ok(true);
    }
    let holder: Option<Uuid> = sqlx::query_scalar(
        "SELECT assignee_id FROM crm_records WHERE workspace_id=$1 AND collection='Clients' \
         AND legacy_id=$2",
    )
    .bind(workspace)
    .bind(spec.deal["clientId"].as_str())
    .fetch_optional(&mut **tx)
    .await
    .map_err(failed)?
    .flatten();
    let Some(holder) = holder.filter(|id| Some(*id) == people.finance(spec.holder)) else {
        return Ok(false);
    };
    let offers = spec
        .steps
        .iter()
        .any(|step| matches!(step, Step::Offer { .. }));
    Ok(!offers
        || gate::relock(tx, workspace, holder, Need::Assign)
            .await
            .is_ok())
}
