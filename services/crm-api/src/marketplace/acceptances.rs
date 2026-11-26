//! One acceptance per member and version (review amendment 4); the database owns the time.
use super::terms::Terms;
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const ALREADY: &str = "You have already accepted these terms.";

/// One acceptance per member and version; the database owns the time.
pub async fn accept(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    member: Uuid,
    terms: &Terms,
) -> ApiResult<()> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM marketplace.crm_market_acceptances \
         WHERE member_id=$1 AND terms_version=$2)",
    )
    .bind(member)
    .bind(&terms.version)
    .fetch_one(&mut **tx)
    .await?;
    if exists {
        // The acceptance is already evidence for this version; joining again after leaving
        // keeps it rather than writing a second row.
        return Ok(());
    }
    sqlx::query(
        "INSERT INTO marketplace.crm_market_acceptances \
         (id,member_id,workspace_id,terms_version,terms_digest) VALUES ($1,$2,$3,$4,$5)",
    )
    .bind(Uuid::new_v4())
    .bind(member)
    .bind(workspace)
    .bind(&terms.version)
    .bind(&terms.digest)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// One publication consent each time the member gives it (MK1 code review M3).
pub async fn consent(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    member: Uuid,
    terms: &Terms,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO marketplace.crm_market_consents \
         (id,member_id,workspace_id,terms_version,terms_digest) VALUES ($1,$2,$3,$4,$5)",
    )
    .bind(Uuid::new_v4())
    .bind(member)
    .bind(workspace)
    .bind(&terms.version)
    .bind(&terms.digest)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Whether the member accepted this version.
pub async fn accepted(
    tx: &mut Transaction<'_, Postgres>,
    member: Uuid,
    version: &str,
) -> ApiResult<bool> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM marketplace.crm_market_acceptances \
         WHERE member_id=$1 AND terms_version=$2)",
    )
    .bind(member)
    .bind(version)
    .fetch_one(&mut **tx)
    .await?)
}
