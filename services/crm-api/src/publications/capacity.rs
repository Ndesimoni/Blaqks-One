use super::{
    model::{Publication, COLUMNS},
    read,
};
use crate::error::{ApiError, ApiResult};
use sqlx::{Postgres, Transaction};
use std::collections::HashSet;
use uuid::Uuid;

pub async fn ensure(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    physical: &str,
    id: Uuid,
    general: bool,
) -> ApiResult<()> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 51))")
        .bind(physical)
        .execute(&mut **tx)
        .await?;
    let rows:Vec<Publication>=sqlx::query_as(&format!("SELECT {COLUMNS} FROM publications.crm_website_listings WHERE physical_key=$1 AND active AND id<>$2 ORDER BY id"))
        .bind(physical).bind(id).fetch_all(&mut **tx).await?;
    let mut team = 0;
    let mut general_teams = HashSet::new();
    for row in rows {
        if !read::eligible(tx, &row).await? {
            continue;
        }
        if row.workspace == workspace {
            team += 1;
        }
        if row.destination == "general_and_company" {
            general_teams.insert(row.workspace);
        }
    }
    if team >= 2 || (general && !general_teams.contains(workspace) && general_teams.len() >= 2) {
        return Err(ApiError::conflict(
            "This property has reached its public listing limit.",
        ));
    }
    Ok(())
}
