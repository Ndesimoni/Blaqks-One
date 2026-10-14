//! `seed-sample`: one transaction under the workspace lock. Missing sample records go
//! through the import insertion path (link order, assignment history, redacted
//! activity attributed to the workspace owner with source `sample`), are marked in
//! `crm_sample_records`, and the records each sample member holds are reassigned.
use super::{
    accounts::{self, Member},
    credentials, data,
    dates::Calendar,
    existing, failed, mark_source,
    staff::SPECS,
    target::{Target, UNCHANGED},
    Outcome,
};
use crate::{
    assignments::eligibility,
    imports::insertion::{self, Inserted},
    records::history::{self, Change},
    team::access,
    workspaces,
};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

pub struct Seeded {
    pub counts: existing::Counts,
    pub members: Vec<Member>,
    pub generated: Vec<Option<String>>,
}

pub async fn seed(pool: &PgPool, target: &Target, staff: bool) -> Outcome<Seeded> {
    let count = if staff { SPECS.len() } else { 0 };
    let credentials = credentials::credentials(count).await?;
    let records = data::records(&Calendar::now());
    let mut tx = pool.begin().await.map_err(failed)?;
    let workspace = target.workspace.as_str();
    workspaces::lock(&mut tx, workspace).await.map_err(failed)?;
    workspaces::ensure_writable(&mut tx, workspace, target.owner, None, None)
        .await
        .map_err(|_| format!("The Admin or workspace is no longer active.{UNCHANGED}"))?;
    mark_source(&mut tx).await?;
    let (missing, counts) = existing::split(&mut tx, workspace, records).await?;
    let mut members = Vec::new();
    if staff {
        access::lock_owner(&mut tx, target.owner)
            .await
            .map_err(failed)?;
        for (spec, credential) in SPECS.iter().zip(&credentials) {
            members.push(accounts::ensure(&mut tx, target, spec, credential).await?);
        }
    }
    let inserted = insertion::insert(&mut tx, workspace, target.owner, missing)
        .await
        .map_err(failed)?;
    let ids: Vec<Uuid> = inserted.iter().map(|(_, _, id)| *id).collect();
    sqlx::query(
        "INSERT INTO crm_sample_records (record_id,workspace_id) SELECT unnest($1::uuid[]),$2",
    )
    .bind(&ids)
    .bind(workspace)
    .execute(&mut *tx)
    .await
    .map_err(failed)?;
    for member in &members {
        assign(&mut tx, target, member, &inserted).await?;
    }
    tx.commit().await.map_err(failed)?;
    let generated = members
        .iter()
        .zip(credentials)
        .map(|(member, credential)| match member.status {
            accounts::Status::Created | accounts::Status::Reactivated => credential.generated,
            _ => None,
        })
        .collect();
    Ok(Seeded {
        counts,
        members,
        generated,
    })
}

/// Hands each newly inserted record the member holds to them, through the same
/// eligibility check and history/activity path as a reassignment in the app.
/// Records that were already present keep whatever assignment they have now.
async fn assign(
    tx: &mut Transaction<'_, Postgres>,
    target: &Target,
    member: &Member,
    inserted: &[Inserted],
) -> Outcome<()> {
    let Some(holder) = member.holder else {
        return Ok(());
    };
    let held = inserted
        .iter()
        .filter(|(_, legacy_id, _)| member.spec.holds.contains(&legacy_id.as_str()));
    for (collection, _, record) in held {
        eligibility::eligible(tx, &target.workspace, collection, holder)
            .await
            .map_err(failed)?;
        let from: Option<Uuid> =
            sqlx::query_scalar("SELECT assignee_id FROM crm_records WHERE id=$1 FOR UPDATE")
                .bind(record)
                .fetch_one(&mut **tx)
                .await
                .map_err(failed)?;
        let change = Change {
            workspace: &target.workspace,
            record: *record,
            collection,
            from,
            to: Some(holder),
            actor: target.owner,
            reason: "reassigned",
        };
        history::reassign(tx, &change, false)
            .await
            .map_err(failed)?;
    }
    Ok(())
}
