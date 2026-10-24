//! Closing and counting requests (packet MK2): the member's open slots, the one-open-per-client
//! rule, an explicit Close, leaving the marketplace, and a client who moved on. `open` on the
//! source always moves with `closed_at`, in the same statement's transaction.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Open means not closed and not past its expiry: an expired request frees its slot.
pub async fn count_open(tx: &mut Transaction<'_, Postgres>, member: Uuid) -> ApiResult<i64> {
    Ok(sqlx::query_scalar(
        "SELECT count(*) FROM marketplace.crm_market_requests \
         WHERE member_id=$1 AND closed_at IS NULL AND expires_at > now()",
    )
    .bind(member)
    .fetch_one(&mut **tx)
    .await?)
}

/// Whether that client already has a request holding its slot.
pub async fn open_for_client(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    client: Uuid,
) -> ApiResult<bool> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM marketplace.crm_market_request_sources \
         WHERE workspace_id=$1 AND source_record_id=$2 AND open)",
    )
    .bind(workspace)
    .bind(client)
    .fetch_one(&mut **tx)
    .await?)
}

/// Closes the client's expired requests (`expired`) so a new request may take the client's slot,
/// returning each closed request with its poster.
pub async fn close_expired_for_client(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    client: Uuid,
) -> ApiResult<Vec<(Uuid, Uuid)>> {
    let closed: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "UPDATE marketplace.crm_market_requests r SET closed_at=now(),close_reason='expired', \
         updated_at=now(),version=r.version+1 FROM marketplace.crm_market_request_sources s \
         WHERE s.request_id=r.id AND s.workspace_id=$1 AND s.source_record_id=$2 AND s.open \
           AND r.closed_at IS NULL AND r.expires_at <= now() RETURNING r.id,r.member_id",
    )
    .bind(workspace)
    .bind(client)
    .fetch_all(&mut **tx)
    .await?;
    let ids: Vec<Uuid> = closed.iter().map(|(id, _)| *id).collect();
    sqlx::query(
        "UPDATE marketplace.crm_market_request_sources SET open=false WHERE request_id=ANY($1)",
    )
    .bind(&ids)
    .execute(&mut **tx)
    .await?;
    Ok(closed)
}

/// Closes the member's open requests with `reason` and frees their clients, returning the IDs.
async fn close_where(
    tx: &mut Transaction<'_, Postgres>,
    member: Uuid,
    reason: &str,
) -> ApiResult<Vec<Uuid>> {
    let ids: Vec<Uuid> = sqlx::query_scalar(
        "UPDATE marketplace.crm_market_requests SET closed_at=now(),close_reason=$2, \
         updated_at=now(),version=version+1 \
         WHERE member_id=$1 AND closed_at IS NULL RETURNING id",
    )
    .bind(member)
    .bind(reason)
    .fetch_all(&mut **tx)
    .await?;
    if !ids.is_empty() {
        sqlx::query(
            "UPDATE marketplace.crm_market_request_sources SET open=false WHERE request_id=ANY($1)",
        )
        .bind(&ids)
        .execute(&mut **tx)
        .await?;
    }
    Ok(ids)
}

/// Leaving the marketplace ends every open request in the same transaction.
pub async fn close_left(tx: &mut Transaction<'_, Postgres>, member: Uuid) -> ApiResult<Vec<Uuid>> {
    close_where(tx, member, "left").await
}

/// Closes one request the poster asked to close, freeing its client.
pub async fn close(tx: &mut Transaction<'_, Postgres>, id: Uuid, member: Uuid) -> ApiResult<bool> {
    let closed: Option<Uuid> = sqlx::query_scalar(
        "UPDATE marketplace.crm_market_requests SET closed_at=now(),close_reason='done', \
         updated_at=now(),version=version+1 \
         WHERE id=$1 AND member_id=$2 AND closed_at IS NULL RETURNING id",
    )
    .bind(id)
    .bind(member)
    .fetch_optional(&mut **tx)
    .await?;
    if closed.is_none() {
        return Ok(false);
    }
    sqlx::query("UPDATE marketplace.crm_market_request_sources SET open=false WHERE request_id=$1")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(true)
}

/// Closes the requests whose client the poster no longer holds (the lazy half of
/// `client_changed`; the board hides them before this runs).
pub async fn close_changed(tx: &mut Transaction<'_, Postgres>, ids: &[Uuid]) -> ApiResult<()> {
    if ids.is_empty() {
        return Ok(());
    }
    sqlx::query(
        "UPDATE marketplace.crm_market_requests SET closed_at=now(),close_reason='client_changed', \
         updated_at=now(),version=version+1 \
         WHERE id=ANY($1) AND closed_at IS NULL",
    )
    .bind(ids)
    .execute(&mut **tx)
    .await?;
    sqlx::query(
        "UPDATE marketplace.crm_market_request_sources SET open=false WHERE request_id=ANY($1)",
    )
    .bind(ids)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
