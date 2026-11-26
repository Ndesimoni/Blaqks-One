//! The two database reads behind the marketplace allowlist (packet MK2): the pre-filled
//! requirements of one of the poster's clients, and which of a page's clients their posters still
//! hold. Both call `records` functions for anything another module owns, and neither returns the
//! source record ID to a cross-company response.
use super::{market_requirements::Requirements, shares::rules};
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use std::collections::HashSet;
use uuid::Uuid;

/// The requirements of one of the caller's clients: their own client, or any client of their
/// company when they are its Admin (the R1 sharing rule). Every other client field is never read.
pub async fn read(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    live: &UserRow,
    client: Uuid,
) -> ApiResult<Requirements> {
    rules::shareable(tx, workspace, live, ("Clients", client)).await?;
    let payload: Value = sqlx::query_scalar(
        "SELECT payload FROM crm_records WHERE id=$1 AND workspace_id=$2 \
         AND collection='Clients'",
    )
    .bind(client)
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(ApiError::missing)?;
    Ok(super::market_requirements::from_payload(&payload))
}

/// Which of `(workspace, client, member)` the member still holds: the client exists in that
/// workspace and is assigned to them, or they are that company's Admin. One query, so the board
/// can hide a request whose client moved on without reading `crm_records` itself.
pub async fn still_held(
    tx: &mut Transaction<'_, Postgres>,
    items: &[(String, Uuid, Uuid)],
) -> ApiResult<HashSet<Uuid>> {
    if items.is_empty() {
        return Ok(HashSet::new());
    }
    let workspaces: Vec<String> = items.iter().map(|item| item.0.clone()).collect();
    let records: Vec<Uuid> = items.iter().map(|item| item.1).collect();
    let members: Vec<Uuid> = items.iter().map(|item| item.2).collect();
    let held: Vec<Uuid> = sqlx::query_scalar(
        "SELECT DISTINCT r.id FROM crm_records r \
         JOIN unnest($1::text[],$2::uuid[],$3::uuid[]) AS t(workspace,record,member) \
           ON t.record=r.id AND t.workspace=r.workspace_id \
         WHERE r.collection='Clients' AND (r.assignee_id=t.member OR EXISTS ( \
           SELECT 1 FROM crm_user_profiles p WHERE p.id=t.member \
             AND p.workspace_id=t.workspace AND p.role='admin'))",
    )
    .bind(&workspaces)
    .bind(&records)
    .bind(&members)
    .fetch_all(&mut **tx)
    .await?;
    Ok(held.into_iter().collect())
}
