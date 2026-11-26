//! Blaqks One's own sample data (`seed-platform-sample` / `clear-platform-sample`): four
//! sample team members (one per position), ten sales clients at every stage, five help
//! requests from the companies' sample staff and a little Team chat. Same safety as the
//! company samples (local, marked database; confirmation) and the same "Sample · " label;
//! it never touches a company's own records. Clearing archives the clients, solves the help
//! requests (both kept as history), removes the chat and suspends the team members.
pub mod chat;
pub mod chat_data;
pub mod client_spec;
pub mod clients;
pub mod clients_data;
pub mod enrol;
pub mod help;
pub mod help_data;
pub mod marks;
pub mod people;
pub mod report;
pub mod team;

use super::{
    confirm, credentials, failed, mark_source,
    options::{Command, Options},
    target::{Target, UNCHANGED},
    Outcome,
};
use crate::workspaces::{self, ORGANISATION};
use people::{People, SPECS};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

#[derive(FromRow)]
struct Owner {
    id: Uuid,
    name: String,
    email: String,
}

pub async fn run(pool: &PgPool, options: Options, database: &str) -> Outcome<String> {
    let owners = sqlx::query_as::<_, Owner>(
        "SELECT id,name,email FROM crm_users WHERE role='super-admin' AND active \
         AND deleted_at IS NULL",
    )
    .fetch_all(pool)
    .await
    .map_err(failed)?;
    let [owner] = owners.as_slice() else {
        return Err(format!(
            "Expected one live Blaqks One Owner account.{UNCHANGED}"
        ));
    };
    let target = Target {
        owner: owner.id,
        name: owner.name.clone(),
        email: owner.email.clone(),
        workspace: ORGANISATION.to_owned(),
    };
    confirm::confirm(&options, database, &target)?;
    match options.command {
        Command::Seed => seed(pool, &target, options.staff).await,
        Command::Clear => clear(pool, &target).await,
    }
}

/// One transaction under the organisation's lock, as the live Owner.
async fn begin<'c>(pool: &PgPool, target: &Target) -> Outcome<Transaction<'c, Postgres>> {
    let mut tx = pool.begin().await.map_err(failed)?;
    workspaces::lock(&mut tx, ORGANISATION)
        .await
        .map_err(failed)?;
    mark_source(&mut tx).await?;
    let live: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM crm_users WHERE id=$1 AND role='super-admin' AND active \
         AND deleted_at IS NULL)",
    )
    .bind(target.owner)
    .fetch_one(&mut *tx)
    .await
    .map_err(failed)?;
    if !live {
        return Err(format!(
            "The Blaqks One Owner is no longer active.{UNCHANGED}"
        ));
    }
    Ok(tx)
}

async fn seed(pool: &PgPool, target: &Target, staff: bool) -> Outcome<String> {
    let specs = if staff { &SPECS[..] } else { &[] };
    let credentials = credentials::credentials(specs.len()).await?;
    let mut tx = begin(pool, target).await?;
    let mut members = Vec::with_capacity(specs.len());
    for (spec, credential) in specs.iter().zip(&credentials) {
        let member = team::ensure(&mut tx, target.owner, &target.email, spec, credential);
        members.push(member.await?);
    }
    let people = People::new(target.owner, &members);
    let clients = clients::seed(&mut tx, &people).await?;
    let help = help::seed(&mut tx, &people).await?;
    let chat = chat::seed(&mut tx, &people).await?;
    tx.commit().await.map_err(failed)?;
    let seeded = report::Seeded {
        clients,
        help,
        chat,
    };
    Ok(report::seeded(target, &seeded, &members, &credentials))
}

async fn clear(pool: &PgPool, target: &Target) -> Outcome<String> {
    let mut tx = begin(pool, target).await?;
    let cleared = report::Cleared {
        clients: clients::clear(&mut tx).await?,
        help: help::clear(&mut tx).await?,
        chat: chat::clear(&mut tx).await?,
        team: team::suspend(&mut tx, target.owner).await?,
    };
    marks::clear_all(&mut tx).await?;
    tx.commit().await.map_err(failed)?;
    Ok(report::cleared(target, &cleared))
}
