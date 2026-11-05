//! The rows `seed-platform-sample` added (`crm_sample_platform`), so `clear-platform-sample`
//! touches exactly those and a later seed knows what is already there.
use super::super::{failed, Outcome};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

pub async fn mark(tx: &mut Tx<'_>, entity: &str, ids: &[Uuid]) -> Outcome<()> {
    sqlx::query("INSERT INTO crm_sample_platform (entity,id) SELECT $1,unnest($2::uuid[])")
        .bind(entity)
        .bind(ids)
        .execute(&mut **tx)
        .await
        .map_err(failed)?;
    Ok(())
}

/// The sample rows of `entity` not cleared yet.
pub async fn live(tx: &mut Tx<'_>, entity: &str) -> Outcome<Vec<Uuid>> {
    sqlx::query_scalar("SELECT id FROM crm_sample_platform WHERE entity=$1 AND cleared_at IS NULL")
        .bind(entity)
        .fetch_all(&mut **tx)
        .await
        .map_err(failed)
}

pub async fn clear_all(tx: &mut Tx<'_>) -> Outcome<()> {
    sqlx::query("UPDATE crm_sample_platform SET cleared_at=now() WHERE cleared_at IS NULL")
        .execute(&mut **tx)
        .await
        .map_err(failed)?;
    Ok(())
}
