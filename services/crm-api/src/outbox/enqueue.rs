//! The only way a domain creates a job. Called inside the domain's own transaction, so the
//! job commits with the object it sends.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Queues one send of `object_id`. A second call while a job is pending or leased returns
/// that live job instead of creating another, so one object never has two live jobs.
pub async fn enqueue(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    domain: &str,
    object_id: Uuid,
) -> ApiResult<Uuid> {
    let inserted: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO outbox.crm_outbox_jobs (id,workspace_id,domain,object_id,kind,state) \
         VALUES ($1,$2,$3,$4,'send','pending') \
         ON CONFLICT (domain,object_id) WHERE state IN ('pending','leased') DO NOTHING \
         RETURNING id",
    )
    .bind(Uuid::new_v4())
    .bind(workspace)
    .bind(domain)
    .bind(object_id)
    .fetch_optional(&mut **transaction)
    .await?;
    if let Some(id) = inserted {
        return Ok(id);
    }
    sqlx::query_scalar(
        "SELECT id FROM outbox.crm_outbox_jobs \
         WHERE domain=$1 AND object_id=$2 AND state IN ('pending','leased')",
    )
    .bind(domain)
    .bind(object_id)
    .fetch_one(&mut **transaction)
    .await
    .map_err(Into::into)
}
