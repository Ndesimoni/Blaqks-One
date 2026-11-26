//! The poster's side of a request (packet MK2): which client it came from, in a table no other
//! company's response reads.
use crate::error::{ApiError, ApiResult};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Records the client a new request came from. Two posters racing for one client meet the
/// one-open-per-client index; the loser gets the same refusal as the earlier check gives.
pub async fn insert(
    tx: &mut Transaction<'_, Postgres>,
    request: Uuid,
    workspace: &str,
    client: Uuid,
) -> ApiResult<()> {
    let inserted = sqlx::query(
        "INSERT INTO marketplace.crm_market_request_sources \
         (request_id,workspace_id,source_record_id,open) VALUES ($1,$2,$3,true)",
    )
    .bind(request)
    .bind(workspace)
    .bind(client)
    .execute(&mut **tx)
    .await;
    match inserted {
        Err(sqlx::Error::Database(error)) if error.code().as_deref() == Some("23505") => {
            Err(ApiError::conflict(super::requests_post::CLIENT_OPEN))
        }
        Err(error) => Err(error.into()),
        Ok(_) => Ok(()),
    }
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
