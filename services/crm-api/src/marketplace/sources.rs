//! The poster's side of a request (packet MK2): which client it came from, in a table no other
//! company's response reads.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn insert(
    tx: &mut Transaction<'_, Postgres>,
    request: Uuid,
    workspace: &str,
    client: Uuid,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO marketplace.crm_market_request_sources \
         (request_id,workspace_id,source_record_id,open) VALUES ($1,$2,$3,true)",
    )
    .bind(request)
    .bind(workspace)
    .bind(client)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The client a request came from, for My requests on the poster's side only.
pub async fn client_of(
    tx: &mut Transaction<'_, Postgres>,
    request: Uuid,
) -> ApiResult<Option<Uuid>> {
    Ok(sqlx::query_scalar(
        "SELECT source_record_id FROM marketplace.crm_market_request_sources WHERE request_id=$1",
    )
    .bind(request)
    .fetch_optional(&mut **tx)
    .await?)
}

/// `(request, client)` for a page the server is judging. The board uses it to ask whether each
/// poster still holds their client; no cross-company response ever carries either ID.
pub async fn for_requests(
    tx: &mut Transaction<'_, Postgres>,
    requests: &[Uuid],
) -> ApiResult<Vec<(Uuid, Uuid)>> {
    Ok(sqlx::query_as(
        "SELECT request_id,source_record_id FROM marketplace.crm_market_request_sources \
         WHERE request_id=ANY($1)",
    )
    .bind(requests)
    .fetch_all(&mut **tx)
    .await?)
}

/// Every request with its client, for the poster's own My requests read.
pub async fn clients_of(
    tx: &mut Transaction<'_, Postgres>,
    member: Uuid,
) -> ApiResult<Vec<(Uuid, Uuid)>> {
    Ok(sqlx::query_as(
        "SELECT s.request_id,s.source_record_id FROM marketplace.crm_market_request_sources s \
         JOIN marketplace.crm_market_requests r ON r.id=s.request_id \
         WHERE r.member_id=$1",
    )
    .bind(member)
    .fetch_all(&mut **tx)
    .await?)
}
