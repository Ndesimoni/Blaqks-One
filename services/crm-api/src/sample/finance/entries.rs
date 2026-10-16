//! Sample payments and expenses through the owners' writes (`payments::create::insert`,
//! `expenses::create::insert`), then decided by the Admin through `approval::apply`:
//! approvals and rejections first, voids last (the void opens the Admin path).
use super::{
    super::{dates::Calendar, failed, Outcome},
    ledger::{self, EntrySpec, Outcome as End},
    people::People,
    present::{self, Tally, EXPENSES, PAYMENTS},
    Seeded,
};
use crate::{
    auth::profile::UserRow,
    error::ApiResult,
    finance::{approval, approval_rules::Verdict, entry::Kind, expenses, payments},
};
use serde_json::json;
use sqlx::{Postgres, Transaction};
use std::collections::HashMap;
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

pub async fn seed(
    tx: &mut Tx<'_>,
    admin: &UserRow,
    people: &People,
    deals: &HashMap<&'static str, Uuid>,
    calendar: &Calendar,
    seeded: &mut Seeded,
) -> Outcome<()> {
    let workspace = admin.workspace_id.as_str();
    let mut decisions = Vec::new();
    let mut tally = Tally::default();
    for spec in ledger::payments(calendar) {
        if present::present(tx, PAYMENTS, workspace, spec.id).await? {
            tally.present += 1;
        } else if !deals.contains_key(spec.deal) {
            tally.skipped += 1; // only recorded together with its sample deal
        } else {
            let input = payments::input::parse(&spec.wire, true).map_err(failed)?;
            let id = payments::create::insert(tx, workspace, admin, &input, spec.id).await;
            decisions.push(added(tx, (&mut tally, workspace), (Kind::Payment, &spec), id).await?);
        }
    }
    seeded.rows.push(("Payments", tally));
    let mut tally = Tally::default();
    for mut spec in ledger::expenses(calendar) {
        if present::present(tx, EXPENSES, workspace, spec.id).await? {
            tally.present += 1;
            continue;
        }
        let Some(owner) = people.finance(spec.owner) else {
            tally.skipped += 1;
            continue;
        };
        spec.wire["incurredBy"] = json!(owner.to_string());
        let input = expenses::input::parse(&spec.wire, true, true).map_err(failed)?;
        let id = expenses::create::insert(tx, workspace, admin, &input, spec.id).await;
        decisions.push(added(tx, (&mut tally, workspace), (Kind::Expense, &spec), id).await?);
    }
    seeded.rows.push(("Expenses", tally));
    decide(tx, admin, &decisions).await
}

/// Marks a created entry and queues its decision.
async fn added(
    tx: &mut Tx<'_>,
    (tally, workspace): (&mut Tally, &str),
    (kind, spec): (Kind, &EntrySpec),
    id: ApiResult<Uuid>,
) -> Outcome<(Kind, Uuid, End)> {
    let id = id.map_err(failed)?;
    let entity = match kind {
        Kind::Payment => "payment",
        Kind::Expense => "expense",
    };
    present::mark(tx, entity, id, workspace).await?;
    tally.added += 1;
    Ok((kind, id, spec.outcome))
}

/// New entries are at version 1; a void follows its approval at version 2.
async fn decide(tx: &mut Tx<'_>, admin: &UserRow, decisions: &[(Kind, Uuid, End)]) -> Outcome<()> {
    let workspace = admin.workspace_id.as_str();
    let mut voids = Vec::new();
    for (kind, id, end) in decisions {
        let (verdict, reason) = match end {
            End::Pending => continue,
            End::Approved => (Verdict::Approve, None),
            End::Voided(reason) => {
                voids.push((*kind, *id, *reason));
                (Verdict::Approve, None)
            }
            End::Rejected(reason) => (Verdict::Reject, Some(reason.to_string())),
        };
        approval::apply(tx, workspace, admin, (*kind, verdict), *id, 1, reason)
            .await
            .map_err(failed)?;
    }
    for (kind, id, reason) in voids {
        let reason = Some(reason.to_string());
        approval::apply(tx, workspace, admin, (kind, Verdict::Void), id, 2, reason)
            .await
            .map_err(failed)?;
    }
    Ok(())
}
